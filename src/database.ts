import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import initSqlJs, { Database as SqlJsDatabase, SqlValue } from 'sql.js';

export interface Session {
    id?: number;
    file_path: string;
    project_path: string | null;
    start_time: number;
    end_time: number | null;
    duration_ms: number | null;
}

export interface FileStats {
    file_path: string;
    project_path: string | null;
    total_time_ms: number;
    last_active: number;
}

export interface ProjectStats {
    project_path: string;
    total_time_ms: number;
    file_count: number;
    last_active: number;
}

export class DatabaseManager {
    private db: SqlJsDatabase | null = null;
    private dbPath: string;
    private dataDir: string;
    private saveTimeout: NodeJS.Timeout | null = null;

    constructor() {
        this.dataDir = path.join(os.homedir(), '.codingtimetracker');
        this.dbPath = path.join(this.dataDir, 'timetracker.db');
    }

    public async initialize(): Promise<void> {
        // Ensure data directory exists
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        // Initialize SQL.js
        const SQL = await initSqlJs();

        // Load existing database or create new one
        if (fs.existsSync(this.dbPath)) {
            const fileBuffer = fs.readFileSync(this.dbPath);
            this.db = new SQL.Database(fileBuffer);
        } else {
            this.db = new SQL.Database();
        }

        this.createTables();
    }

    private createTables(): void {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        this.db.run(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                project_path TEXT,
                start_time INTEGER NOT NULL,
                end_time INTEGER,
                duration_ms INTEGER
            )
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS file_stats (
                file_path TEXT PRIMARY KEY,
                project_path TEXT,
                total_time_ms INTEGER DEFAULT 0,
                last_active INTEGER
            )
        `);

        this.db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_file ON sessions(file_path)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_file_stats_project ON file_stats(project_path)`);

        this.scheduleSave();
    }

    private scheduleSave(): void {
        // Debounce saves to avoid excessive disk writes
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.saveToDisk();
        }, 1000);
    }

    private saveToDisk(): void {
        if (!this.db) {
            return;
        }
        try {
            const data = this.db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(this.dbPath, buffer);
        } catch (error) {
            console.error('Failed to save database:', error);
        }
    }

    public startSession(filePath: string, projectPath: string | null): number {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const startTime = Date.now();
        this.db.run(
            `INSERT INTO sessions (file_path, project_path, start_time) VALUES (?, ?, ?)`,
            [filePath, projectPath, startTime]
        );

        // Get the last inserted row id
        const result = this.db.exec('SELECT last_insert_rowid() as id');
        const sessionId = result[0]?.values[0]?.[0] as number;

        this.scheduleSave();
        return sessionId;
    }

    public endSession(sessionId: number): void {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        // Get session start time
        const sessionResult = this.db.exec(
            `SELECT file_path, project_path, start_time FROM sessions WHERE id = ?`,
            [sessionId]
        );

        if (!sessionResult[0] || !sessionResult[0].values[0]) {
            return;
        }

        const row = sessionResult[0].values[0];
        const filePath = row[0] as string;
        const projectPath = row[1] as string | null;
        const startTime = row[2] as number;

        const endTime = Date.now();
        const durationMs = endTime - startTime;

        // Update session with end time and duration
        this.db.run(
            `UPDATE sessions SET end_time = ?, duration_ms = ? WHERE id = ?`,
            [endTime, durationMs, sessionId]
        );

        // Update file stats
        this.updateFileStats(filePath, projectPath, durationMs, endTime);

        this.scheduleSave();
    }

    private updateFileStats(filePath: string, projectPath: string | null, durationMs: number, timestamp: number): void {
        if (!this.db) {
            return;
        }

        // Check if file stats exist
        const existing = this.db.exec(
            `SELECT total_time_ms FROM file_stats WHERE file_path = ?`,
            [filePath]
        );

        if (existing[0] && existing[0].values[0]) {
            this.db.run(
                `UPDATE file_stats SET total_time_ms = total_time_ms + ?, last_active = ? WHERE file_path = ?`,
                [durationMs, timestamp, filePath]
            );
        } else {
            this.db.run(
                `INSERT INTO file_stats (file_path, project_path, total_time_ms, last_active) VALUES (?, ?, ?, ?)`,
                [filePath, projectPath, durationMs, timestamp]
            );
        }
    }

    public getFileStats(filePath: string): FileStats | undefined {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const result = this.db.exec(
            `SELECT file_path, project_path, total_time_ms, last_active FROM file_stats WHERE file_path = ?`,
            [filePath]
        );

        if (!result[0] || !result[0].values[0]) {
            return undefined;
        }

        const row = result[0].values[0];
        return {
            file_path: row[0] as string,
            project_path: row[1] as string | null,
            total_time_ms: row[2] as number,
            last_active: row[3] as number
        };
    }

    public getAllFileStats(): FileStats[] {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const result = this.db.exec(
            `SELECT file_path, project_path, total_time_ms, last_active FROM file_stats ORDER BY total_time_ms DESC`
        );

        if (!result[0]) {
            return [];
        }

        return result[0].values.map((row: SqlValue[]) => ({
            file_path: row[0] as string,
            project_path: row[1] as string | null,
            total_time_ms: row[2] as number,
            last_active: row[3] as number
        }));
    }

    public getProjectStats(): ProjectStats[] {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const result = this.db.exec(`
            SELECT 
                project_path,
                SUM(total_time_ms) as total_time_ms,
                COUNT(*) as file_count,
                MAX(last_active) as last_active
            FROM file_stats
            WHERE project_path IS NOT NULL
            GROUP BY project_path
            ORDER BY total_time_ms DESC
        `);

        if (!result[0]) {
            return [];
        }

        return result[0].values.map((row: SqlValue[]) => ({
            project_path: row[0] as string,
            total_time_ms: row[1] as number,
            file_count: row[2] as number,
            last_active: row[3] as number
        }));
    }

    public getFileStatsByProject(projectPath: string): FileStats[] {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const result = this.db.exec(
            `SELECT file_path, project_path, total_time_ms, last_active FROM file_stats WHERE project_path = ? ORDER BY total_time_ms DESC`,
            [projectPath]
        );

        if (!result[0]) {
            return [];
        }

        return result[0].values.map((row: SqlValue[]) => ({
            file_path: row[0] as string,
            project_path: row[1] as string | null,
            total_time_ms: row[2] as number,
            last_active: row[3] as number
        }));
    }

    public getTodayStats(): { totalTime: number; fileCount: number } {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayStartMs = todayStart.getTime();

        const result = this.db.exec(
            `SELECT 
                COALESCE(SUM(duration_ms), 0) as totalTime,
                COUNT(DISTINCT file_path) as fileCount
            FROM sessions
            WHERE start_time >= ?`,
            [todayStartMs]
        );

        if (!result[0] || !result[0].values[0]) {
            return { totalTime: 0, fileCount: 0 };
        }

        const row = result[0].values[0];
        return {
            totalTime: (row[0] as number) || 0,
            fileCount: (row[1] as number) || 0
        };
    }

    public getOngoingSessions(): Session[] {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const result = this.db.exec(
            `SELECT id, file_path, project_path, start_time, end_time, duration_ms FROM sessions WHERE end_time IS NULL`
        );

        if (!result[0]) {
            return [];
        }

        return result[0].values.map((row: SqlValue[]) => ({
            id: row[0] as number,
            file_path: row[1] as string,
            project_path: row[2] as string | null,
            start_time: row[3] as number,
            end_time: row[4] as number | null,
            duration_ms: row[5] as number | null
        }));
    }

    public close(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }

        if (this.db) {
            // End any ongoing sessions before closing
            const ongoingSessions = this.getOngoingSessions();
            for (const session of ongoingSessions) {
                if (session.id) {
                    this.endSession(session.id);
                }
            }
            
            // Final save
            this.saveToDisk();
            
            this.db.close();
            this.db = null;
        }
    }
}
