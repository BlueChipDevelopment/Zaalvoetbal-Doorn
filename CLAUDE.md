# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development server
npm start
# or
ng serve

# Build for production
ng build --configuration production

# Run tests
ng test

# E2E tests
ng e2e

# Deploy to GitHub Pages
ng deploy
```

## Architecture Overview

This is an Angular 18 application for managing futsal team generation, player statistics, and match attendance. The application integrates with Google Sheets as a backend data store through Firebase Functions.

### Core Components Structure

- **Team Generator** (`src/app/components/team-generator/`) - Generates balanced futsal teams based on player ratings and positions
- **Leaderboard** (`src/app/components/leaderboard/`) - Displays player rankings, statistics, and team chemistry analysis  
- **Attendance** (`src/app/components/attendance/`) - Manages player attendance for matches
- **Kalender** (`src/app/components/kalender/`) - Calendar view for players to mark availability
- **Wedstrijden** (`src/app/components/wedstrijden/`) - Match management and history
- **Score** (`src/app/components/score/`) - Score entry and match result tracking

### Key Services

- **GoogleSheetsService** - Handles all Google Sheets API integration via Firebase Functions
- **PlayerService** - Manages player data and statistics
- **TeamGenerateService** - Core team balancing algorithms
- **AttendanceService** - Player attendance management
- **WedstrijdenService** - Match data operations
- **GameStatisticsService** - Player performance analytics
- **NotificationService** - Manages Web Push notifications and browser subscription handling

### Data Architecture

The app uses Google Sheets as the primary data store with these main sheets:
- **Spelers** - Player information, ratings, and statistics
- **Wedstrijden** - Match data and results
- **Aanwezigheid** - Player attendance records
- **LaatsteTeams** - Latest generated team compositions
- **Notificaties** - Push notification subscription data and player preferences

### Key Interfaces

All TypeScript interfaces are centralized in `src/app/interfaces/`:
- `IPlayer.ts` - Player data structure
- `IWedstrijd.ts` - Match data structure
- `ITeam.ts` - Team composition structure
- `IAttendance.ts` - Attendance tracking structure

### Styling

- Uses Angular Material with the `deeppurple-amber` theme
- SCSS variables are defined in `src/styles_variables.scss`
- Component-specific styles follow Angular's encapsulated styling approach

### Google Sheets Integration

The Firebase Functions backend (referenced as `firebaseBaseUrl` in environment) provides:
- `getSheetData` - Retrieve sheet data
- `appendSheetRow` - Add new rows
- `updateSheetRow` - Update existing rows  
- `batchUpdateSheet` - Bulk operations
- `querySheetData` - Filtered data queries

Always skip header rows when processing Google Sheets data (first row contains column headers).

### Deployment

- Build output goes to `dist/browser/` (see angular.json)
- CNAME file in `src/CNAME` is copied to build for custom domain
- Uses `angular-cli-ghpages` for GitHub Pages deployment
- Service Worker configured for PWA functionality

### Environment Configuration

- Environment files are in `src/environments/`
- `firebaseBaseUrl` must be configured for Google Sheets integration
- See `.example` files for required environment variables

### Testing

- Uses Jasmine/Karma for unit tests
- Protractor for E2E testing
- Test files follow `*.spec.ts` naming convention