# Changelog

All notable changes to the CodingtimeTracker extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-11-25

### Added

- Initial release of CodingtimeTracker
- Automatic time tracking with 2-minute idle timeout
- Per-file statistics tracking
- Per-project/workspace statistics aggregation
- Session recording with start/stop times
- Global SQLite database storage in `~/.codingtimetracker/`
- Status bar integration showing current session time
- Commands:
  - `CodingtimeTracker: Show All Statistics` - Display all tracking statistics
  - `CodingtimeTracker: Show Current File Statistics` - Show stats for active file
  - `CodingtimeTracker: Export Data` - Export tracking data

### Technical

- Built with TypeScript
- Uses sql.js for SQLite database management
- Activates on VS Code startup

