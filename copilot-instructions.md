# Copilot Instructions

## Project Overview
This is an Angular 18 application for managing futsal team generation, player statistics, match attendance, and team chemistry analysis. The application integrates with Google Sheets as a backend data store through Firebase Functions.

## Development Commands
```bash
# Development server (no Service Worker)
npm start  # or ng serve

# Build for production with combined Service Worker
npm run build:prod  # Builds app → injects custom Web Push handler into Angular service worker

# Test production build locally (with Service Worker)
npx http-server dist -p 8080 -c-1

# Deploy to GitHub Pages
npm run deploy

# Run tests
ng test
```

## Architecture & Core Components

### Main Components Structure
- **Team Generator** (`src/app/components/team-generator/`) - Generates balanced futsal teams based on player ratings, positions, and team chemistry
- **Leaderboard** (`src/app/components/leaderboard/`) - Displays player rankings, statistics, and team chemistry analysis  
- **Attendance** (`src/app/components/attendance/`) - Manages player attendance for matches
- **Kalender** (`src/app/components/kalender/`) - Calendar view for players to mark availability
- **Wedstrijden** (`src/app/components/wedstrijden/`) - Match management and history
- **Score** (`src/app/components/score/`) - Score entry and match result tracking
- **Opstelling** (`src/app/components/opstelling/`) - Team lineup display and analysis

### Key Services
- **GoogleSheetsService** - Handles all Google Sheets API integration via Firebase Functions
- **PlayerService** - Manages player data and statistics
- **TeamGenerateService** - Core team balancing algorithms with chemistry calculations
- **AttendanceService** - Player attendance management
- **WedstrijdenService** - Match data operations
- **GameStatisticsService** - Player performance analytics with season filtering
- **NotificationService** - Manages Web Push notifications and browser subscription handling
- **UpdateService** - Handles automatic app updates and version management

## Data Architecture

### Google Sheets Integration
The app uses Google Sheets as the primary data store with these main sheets:
- **Spelers** - Player information, ratings, positions, and statistics
- **Wedstrijden** - Match data, results, and team compositions
- **Aanwezigheid** - Player attendance records
- **LaatsteTeams** - Latest generated team compositions
- **Notificaties** - Push notification subscription data and player preferences

**IMPORTANT**: Always skip header rows when processing Google Sheets data (first row contains column headers).

**Column Index Constants**: 
- When working in **Firebase Functions**, always use column index constants from `functions/src/config/constants.ts` (see `COLUMN_INDICES` object)
- When working in the **Angular app**, always use column definitions from `src/app/constants/sheet-columns.ts`
- **Never hardcode column indices** (e.g., `row[0]`, `row[1]`) - always use the named constants for maintainability and type safety
- This ensures centralized management: if sheet structure changes, update only the constants file

### Firebase Functions Backend
The Firebase Functions backend provides these endpoints:
- `getSheetData` - Retrieve sheet data
- `appendSheetRow` - Add new rows
- `updateSheetRow` - Update existing rows  
- `batchUpdateSheet` - Bulk operations
- `querySheetData` - Filtered data queries

## Coding Standards & Best Practices

### TypeScript & Type Safety
- Always use interfaces from `src/app/interfaces/` for type safety
- Key interfaces: `IPlayer.ts`, `IWedstrijd.ts`, `ITeam.ts`, `IAttendance.ts`
- Use TypeScript strict mode conventions
- Write code and comments in English; user-facing text may be in Dutch

### Styling Guidelines
- Use Angular Material components for consistent UI
- **CRITICAL**: Always use variables from `src/styles_variables.scss` for colors - never hardcode colors
- Custom color palette defined in `styles_variables.scss`:
  - Primary: `#1976d2` (blue)
  - Secondary: `#616161` (grey) 
  - Success: `#43a047` (green)
  - Error: `#f44336` (red)
- Follow Angular's encapsulated styling approach
- Global styles are in `src/styles.scss`

### Component & Service Structure
- Follow existing folder structure in `src/app/components/` and `src/app/services/`
- Use Angular 18 standalone components where applicable
- Keep components modular, readable, and well-documented
- Implement proper error handling and loading states

### Season & Chemistry System
- The app supports season-based filtering (e.g., "2024-2025", "2025-2026")
- Team chemistry calculations only consider players who played in the same team (not opponents)
- Chemistry statistics show win/loss/tie records for players who played together
- Always filter data by selected season when displaying statistics

## Deployment & Build

### Build Configuration
- Build output goes to `dist/browser/` (configured in angular.json)
- CNAME file in `src/CNAME` is copied to build for custom domain
- Uses `angular-cli-ghpages` for GitHub Pages deployment
- Service Worker configured for PWA functionality with automatic updates
- Build process: `ng build` → `inject-push-handler-sw.js`
- Firebase configuration is extracted from environment files and injected into service worker during build

### Environment Setup
- Environment files are in `src/environments/`
- `firebaseBaseUrl` must be configured for Google Sheets integration
- `vapidPublicKey` required for push notifications
- `firebase` object contains complete Firebase configuration for messaging service worker
- See `.example` files for required environment variables
- **SECURITY**: Never commit actual Firebase credentials to version control

### PWA & Updates
- UpdateService handles automatic app updates with Angular Service Worker integration  
- Smart update checking: network-aware, visibility-aware, and responsive to app state
- Updates checked hourly + when app becomes visible + when network reconnects
- User-friendly update prompts with countdown timer and manual control
- Comprehensive error handling with user feedback for failed updates
- Firebase messaging integrated into combined service worker

## Special Considerations

### File Handling
- Do not generate or edit the root-level `index.html`; use `src/index.html` as the entry point
- CNAME file must be included for deployment
- App version meta tag is used for update detection

### Data Processing
- When processing match data, consider both team white and team red players
- Chemistry calculations require teammate information (players in same team only)
- Season filtering is critical for accurate statistics
- Handle edge cases like players with minimal games played

### Testing
- Uses Jasmine/Karma for unit tests
- Test files follow `*.spec.ts` naming convention
- E2E testing with Protractor

Keep code modular, type-safe, and follow existing patterns in the codebase.
