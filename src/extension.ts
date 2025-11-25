import * as vscode from 'vscode';
import { DatabaseManager } from './database';
import { ActivityTracker } from './tracker';
import { StatusBarManager } from './statusBar';
import { StatsReporter } from './reporter';

let db: DatabaseManager;
let tracker: ActivityTracker;
let statusBar: StatusBarManager;
let reporter: StatsReporter;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('CodingtimeTracker is activating...');

    try {
        // Initialize database (async for sql.js)
        db = new DatabaseManager();
        await db.initialize();

        // Initialize activity tracker
        tracker = new ActivityTracker(db);
        tracker.start();

        // Initialize status bar
        statusBar = new StatusBarManager(db, tracker);
        statusBar.start();

        // Initialize reporter
        reporter = new StatsReporter(db);

        // Register commands
        const showStatsCommand = vscode.commands.registerCommand(
            'codingtimetracker.showStats',
            () => reporter.showAllStats()
        );

        const showFileStatsCommand = vscode.commands.registerCommand(
            'codingtimetracker.showFileStats',
            () => reporter.showFileStats()
        );

        const exportDataCommand = vscode.commands.registerCommand(
            'codingtimetracker.exportData',
            () => reporter.exportData()
        );

        context.subscriptions.push(showStatsCommand);
        context.subscriptions.push(showFileStatsCommand);
        context.subscriptions.push(exportDataCommand);

        console.log('CodingtimeTracker activated successfully!');
    } catch (error) {
        console.error('Failed to activate CodingtimeTracker:', error);
        vscode.window.showErrorMessage(`CodingtimeTracker failed to start: ${error}`);
    }
}

export function deactivate(): void {
    console.log('CodingtimeTracker is deactivating...');

    try {
        // Stop tracker (ends current session)
        if (tracker) {
            tracker.stop();
        }

        // Stop status bar
        if (statusBar) {
            statusBar.stop();
        }

        // Close database connection
        if (db) {
            db.close();
        }

        console.log('CodingtimeTracker deactivated successfully!');
    } catch (error) {
        console.error('Error during CodingtimeTracker deactivation:', error);
    }
}
