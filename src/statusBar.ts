import * as vscode from 'vscode';
import { DatabaseManager } from './database';
import { ActivityTracker } from './tracker';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private db: DatabaseManager;
    private tracker: ActivityTracker;
    private updateInterval: NodeJS.Timeout | null = null;

    constructor(db: DatabaseManager, tracker: ActivityTracker) {
        this.db = db;
        this.tracker = tracker;
        
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'codingtimetracker.showStats';
        this.statusBarItem.tooltip = 'Click to view CodingtimeTracker statistics';
    }

    public start(): void {
        this.update();
        this.statusBarItem.show();

        // Update every 30 seconds
        this.updateInterval = setInterval(() => {
            this.update();
        }, 30 * 1000);

        // Also update when session changes
        this.tracker.onSessionChange(() => {
            this.update();
        });
    }

    private update(): void {
        const todayStats = this.db.getTodayStats();
        const isTracking = this.tracker.isTracking();

        const timeStr = this.formatDuration(todayStats.totalTime);
        const icon = isTracking ? '$(clock)' : '$(clock)';
        const trackingIndicator = isTracking ? '' : ' (idle)';

        this.statusBarItem.text = `${icon} ${timeStr}${trackingIndicator}`;
        this.statusBarItem.tooltip = `CodingtimeTracker: ${timeStr} today across ${todayStats.fileCount} files\nClick to view statistics`;
    }

    private formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            const remainingMinutes = minutes % 60;
            return `${hours}h ${remainingMinutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m`;
        } else {
            return `${seconds}s`;
        }
    }

    public stop(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.statusBarItem.dispose();
    }
}

