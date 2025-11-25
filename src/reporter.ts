import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { DatabaseManager, FileStats, ProjectStats } from './database';

export class StatsReporter {
    private db: DatabaseManager;

    constructor(db: DatabaseManager) {
        this.db = db;
    }

    public async showAllStats(): Promise<void> {
        const projectStats = this.db.getProjectStats();
        const fileStats = this.db.getAllFileStats();
        const todayStats = this.db.getTodayStats();

        const content = this.generateFullReport(projectStats, fileStats, todayStats);
        
        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(doc, { preview: true });
    }

    public async showFileStats(): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showInformationMessage('No active file to show statistics for.');
            return;
        }

        const filePath = activeEditor.document.uri.fsPath;
        const stats = this.db.getFileStats(filePath);

        if (!stats) {
            vscode.window.showInformationMessage(`No tracking data for: ${path.basename(filePath)}`);
            return;
        }

        const content = this.generateFileReport(stats);
        
        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(doc, { preview: true });
    }

    public async exportData(): Promise<void> {
        const projectStats = this.db.getProjectStats();
        const fileStats = this.db.getAllFileStats();
        const todayStats = this.db.getTodayStats();

        // Generate both markdown and CSV content
        const mdContent = this.generateFullReport(projectStats, fileStats, todayStats);
        const csvContent = this.generateCSV(fileStats);

        // Ask user for export format
        const choice = await vscode.window.showQuickPick(
            ['Markdown Report', 'CSV (File Statistics)', 'Both'],
            { placeHolder: 'Select export format' }
        );

        if (!choice) {
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const exportDir = path.join(os.homedir(), '.codingtimetracker', 'exports');

        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        const exportedFiles: string[] = [];

        if (choice === 'Markdown Report' || choice === 'Both') {
            const mdPath = path.join(exportDir, `codingtimetracker-${timestamp}.md`);
            fs.writeFileSync(mdPath, mdContent);
            exportedFiles.push(mdPath);
        }

        if (choice === 'CSV (File Statistics)' || choice === 'Both') {
            const csvPath = path.join(exportDir, `codingtimetracker-${timestamp}.csv`);
            fs.writeFileSync(csvPath, csvContent);
            exportedFiles.push(csvPath);
        }

        const message = `Exported to: ${exportedFiles.map(f => path.basename(f)).join(', ')}`;
        const action = await vscode.window.showInformationMessage(message, 'Open Folder');
        
        if (action === 'Open Folder') {
            vscode.env.openExternal(vscode.Uri.file(exportDir));
        }
    }

    private generateFullReport(
        projectStats: ProjectStats[],
        fileStats: FileStats[],
        todayStats: { totalTime: number; fileCount: number }
    ): string {
        const lines: string[] = [];
        
        lines.push('# CodingtimeTracker Statistics');
        lines.push('');
        lines.push(`*Generated: ${new Date().toLocaleString()}*`);
        lines.push('');

        // Today's summary
        lines.push('## Today\'s Summary');
        lines.push('');
        lines.push(`- **Total Time:** ${this.formatDuration(todayStats.totalTime)}`);
        lines.push(`- **Files Worked On:** ${todayStats.fileCount}`);
        lines.push('');

        // Project statistics
        lines.push('## Time by Project');
        lines.push('');
        
        if (projectStats.length === 0) {
            lines.push('*No project data recorded yet.*');
        } else {
            lines.push('| Project | Total Time | Files | Last Active |');
            lines.push('|---------|------------|-------|-------------|');
            
            for (const project of projectStats) {
                const projectName = path.basename(project.project_path) || project.project_path;
                const timeStr = this.formatDuration(project.total_time_ms);
                const lastActive = new Date(project.last_active).toLocaleDateString();
                lines.push(`| ${projectName} | ${timeStr} | ${project.file_count} | ${lastActive} |`);
            }
        }
        lines.push('');

        // File statistics (top 50)
        lines.push('## Time by File (Top 50)');
        lines.push('');
        
        if (fileStats.length === 0) {
            lines.push('*No file data recorded yet.*');
        } else {
            lines.push('| File | Project | Total Time | Last Active |');
            lines.push('|------|---------|------------|-------------|');
            
            const topFiles = fileStats.slice(0, 50);
            for (const file of topFiles) {
                const fileName = path.basename(file.file_path);
                const projectName = file.project_path ? path.basename(file.project_path) : '-';
                const timeStr = this.formatDuration(file.total_time_ms);
                const lastActive = new Date(file.last_active).toLocaleDateString();
                lines.push(`| ${fileName} | ${projectName} | ${timeStr} | ${lastActive} |`);
            }

            if (fileStats.length > 50) {
                lines.push('');
                lines.push(`*...and ${fileStats.length - 50} more files*`);
            }
        }
        lines.push('');

        // All-time totals
        const totalTimeAllFiles = fileStats.reduce((sum, f) => sum + f.total_time_ms, 0);
        lines.push('## All-Time Totals');
        lines.push('');
        lines.push(`- **Total Time Tracked:** ${this.formatDuration(totalTimeAllFiles)}`);
        lines.push(`- **Total Files Tracked:** ${fileStats.length}`);
        lines.push(`- **Total Projects:** ${projectStats.length}`);
        lines.push('');

        return lines.join('\n');
    }

    private generateFileReport(stats: FileStats): string {
        const lines: string[] = [];
        
        lines.push('# File Statistics');
        lines.push('');
        lines.push(`**File:** ${stats.file_path}`);
        lines.push('');
        lines.push(`- **Total Time:** ${this.formatDuration(stats.total_time_ms)}`);
        lines.push(`- **Project:** ${stats.project_path || 'N/A'}`);
        lines.push(`- **Last Active:** ${new Date(stats.last_active).toLocaleString()}`);
        lines.push('');

        return lines.join('\n');
    }

    private generateCSV(fileStats: FileStats[]): string {
        const lines: string[] = [];
        
        lines.push('file_path,project_path,total_time_ms,total_time_formatted,last_active');
        
        for (const file of fileStats) {
            const escapedFilePath = `"${file.file_path.replace(/"/g, '""')}"`;
            const escapedProjectPath = file.project_path 
                ? `"${file.project_path.replace(/"/g, '""')}"` 
                : '';
            const timeFormatted = this.formatDuration(file.total_time_ms);
            const lastActive = new Date(file.last_active).toISOString();
            
            lines.push(`${escapedFilePath},${escapedProjectPath},${file.total_time_ms},${timeFormatted},${lastActive}`);
        }

        return lines.join('\n');
    }

    private formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            const remainingHours = hours % 24;
            return `${days}d ${remainingHours}h`;
        } else if (hours > 0) {
            const remainingMinutes = minutes % 60;
            return `${hours}h ${remainingMinutes}m`;
        } else if (minutes > 0) {
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            return `${seconds}s`;
        }
    }
}

