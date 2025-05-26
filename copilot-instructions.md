# Copilot Instructions

- This is an Angular 17+ webapp for generating balanced futsal teams, tracking attendance, and managing player statistics.
- Use TypeScript and SCSS conventions as in the existing codebase.
- Always use interfaces from `src/app/interfaces/` for type safety.
- Use Angular Material components for UI.
- When generating new features, follow the folder structure and naming conventions in `src/app/components/` and `src/app/services/`.
- For Google Sheets integration, use or extend `GoogleSheetsService`.
- When processing player or match data from Google Sheets, always skip the header row.
- Use variables from `src/styles_variables.scss` for colors and backgrounds in SCSS.
- Do not generate or edit the root-level `index.html`; use `src/index.html` as the entry point.
- For deployment, ensure the CNAME file is included and the build output is in `dist/browser` (see angular.json).
- Write code and comments in English; user-facing text may be in Dutch.
- Keep code modular, readable, and well-documented.
