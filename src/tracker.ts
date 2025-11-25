import * as vscode from 'vscode';
import { DatabaseManager } from './database';

const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds

export class ActivityTracker {
    private db: DatabaseManager;
    private currentSessionId: number | null = null;
    private currentFilePath: string | null = null;
    private lastActivityTime: number = 0;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private disposables: vscode.Disposable[] = [];
    private onSessionChangeCallbacks: Array<() => void> = [];

    constructor(db: DatabaseManager) {
        this.db = db;
    }

    public start(): void {
        // Listen to text document changes
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((e) => {
                if (e.document.uri.scheme === 'file') {
                    this.onActivity(e.document.uri.fsPath);
                }
            })
        );

        // Listen to active editor changes
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor && editor.document.uri.scheme === 'file') {
                    this.onEditorChange(editor.document.uri.fsPath);
                }
            })
        );

        // Listen to window focus changes
        this.disposables.push(
            vscode.window.onDidChangeWindowState((state) => {
                if (state.focused) {
                    const editor = vscode.window.activeTextEditor;
                    if (editor && editor.document.uri.scheme === 'file') {
                        this.onActivity(editor.document.uri.fsPath);
                    }
                } else {
                    // Window lost focus - end session after idle timeout
                    this.lastActivityTime = Date.now() - IDLE_TIMEOUT_MS;
                }
            })
        );

        // Listen to cursor/selection changes as additional activity signal
        this.disposables.push(
            vscode.window.onDidChangeTextEditorSelection((e) => {
                if (e.textEditor.document.uri.scheme === 'file') {
                    this.onActivity(e.textEditor.document.uri.fsPath);
                }
            })
        );

        // Start heartbeat to check for idle
        this.heartbeatInterval = setInterval(() => {
            this.checkIdle();
        }, HEARTBEAT_INTERVAL_MS);

        // Start tracking if there's already an active editor
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.uri.scheme === 'file') {
            this.onActivity(activeEditor.document.uri.fsPath);
        }
    }

    private onActivity(filePath: string): void {
        this.lastActivityTime = Date.now();

        // If same file, just update activity time
        if (this.currentFilePath === filePath && this.currentSessionId !== null) {
            return;
        }

        // Different file or no active session - switch sessions
        this.startNewSession(filePath);
    }

    private onEditorChange(filePath: string): void {
        // End current session and start new one for the new file
        if (this.currentFilePath !== filePath) {
            this.startNewSession(filePath);
        }
        this.lastActivityTime = Date.now();
    }

    private startNewSession(filePath: string): void {
        // End current session if exists
        this.endCurrentSession();

        // Get project path from workspace folders
        const projectPath = this.getProjectPath(filePath);

        // Start new session
        this.currentSessionId = this.db.startSession(filePath, projectPath);
        this.currentFilePath = filePath;
        this.lastActivityTime = Date.now();

        this.notifySessionChange();
    }

    private endCurrentSession(): void {
        if (this.currentSessionId !== null) {
            this.db.endSession(this.currentSessionId);
            this.currentSessionId = null;
            this.currentFilePath = null;
            this.notifySessionChange();
        }
    }

    private checkIdle(): void {
        if (this.currentSessionId === null) {
            return;
        }

        const now = Date.now();
        const idleTime = now - this.lastActivityTime;

        if (idleTime >= IDLE_TIMEOUT_MS) {
            this.endCurrentSession();
        }
    }

    private getProjectPath(filePath: string): string | null {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return null;
        }

        for (const folder of workspaceFolders) {
            if (filePath.startsWith(folder.uri.fsPath)) {
                return folder.uri.fsPath;
            }
        }

        return null;
    }

    public onSessionChange(callback: () => void): void {
        this.onSessionChangeCallbacks.push(callback);
    }

    private notifySessionChange(): void {
        for (const callback of this.onSessionChangeCallbacks) {
            callback();
        }
    }

    public isTracking(): boolean {
        return this.currentSessionId !== null;
    }

    public getCurrentFilePath(): string | null {
        return this.currentFilePath;
    }

    public getSessionStartTime(): number | null {
        if (this.currentSessionId === null) {
            return null;
        }
        // Approximate: session started when we last started tracking this file
        // For accurate start time, we'd need to query the DB
        return this.lastActivityTime;
    }

    public stop(): void {
        // Stop heartbeat
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        // End current session
        this.endCurrentSession();

        // Dispose all event listeners
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}

