# CodingtimeTracker

A VS Code extension that tracks the time you spend actively editing files.

## Purpose

- **Simple local data storage (SQLite), no dashboards, no cloud, no accounts, no email.**

## Features

- **Automatic Time Tracking**: Tracks time spent in each file with a 2-minute idle timeout
- **Per-File Statistics**: View cumulative time spent on individual files
- **Per-Project Statistics**: Aggregate time by project/workspace
- **Session Recording**: Stores start/stop times for future visualization capabilities
- **Global Database**: Single SQLite database stores all tracking data in `~/.codingtimetracker/`

## Commands

- `CodingtimeTracker: Show All Statistics` - Display time tracking statistics for all files and projects
- `CodingtimeTracker: Show Current File Statistics` - Show stats for the currently active file
- `CodingtimeTracker: Export Data` - Export tracking data to a readable format

## How It Works

1. The extension activates when VS Code starts
2. Activity is detected through text changes, editor switches, and window focus
3. A session begins when you start editing and ends after 2 minutes of inactivity
4. Time is aggregated per file and per project for quick lookups
5. Detailed session data is preserved for future dashboard/visualization features

## Data Storage

All data is stored in a SQLite database at:
- **Windows**: `%USERPROFILE%\.codingtimetracker\timetracker.db`
- **Linux/macOS**: `~/.codingtimetracker/timetracker.db`

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Package extension
npx vsce package
```

## Requirements

- VS Code 1.85.0 or higher

## License

MIT

