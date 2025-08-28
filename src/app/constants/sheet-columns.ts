/**
 * Constanten voor kolom mapping van verschillende Google Sheets
 * Dit zorgt voor consistentie tussen alle componenten en services
 */

// === SHEET NAMES ===

export const SHEET_NAMES = {
  WEDSTRIJDEN: 'Wedstrijden',
  SPELERS: 'Spelers',
  AANWEZIGHEID: 'Aanwezigheid'
} as const;

// === WEDSTRIJDEN SHEET ===

// Kolom indices (0-based) voor array toegang
export const WEDSTRIJD_COLUMNS = {
  ID: 0,           // Kolom A
  SEIZOEN: 1,      // Kolom B  
  DATUM: 2,        // Kolom C
  TEAM_WIT: 3,     // Kolom D
  TEAM_ROOD: 4,    // Kolom E
  SCORE_WIT: 5,    // Kolom F
  SCORE_ROOD: 6,   // Kolom G
  ZLATAN: 7,       // Kolom H
  VENTIEL: 8       // Kolom I
} as const;

// Kolom letters voor spreadsheet ranges
export const WEDSTRIJD_COLUMN_LETTERS = {
  ID: 'A',
  SEIZOEN: 'B',
  DATUM: 'C', 
  TEAM_WIT: 'D',
  TEAM_ROOD: 'E',
  SCORE_WIT: 'F',
  SCORE_ROOD: 'G',
  ZLATAN: 'H',
  VENTIEL: 'I'
} as const;

// Helper functie om ranges te maken
export function createWedstrijdRange(fromColumn: keyof typeof WEDSTRIJD_COLUMN_LETTERS, toColumn: keyof typeof WEDSTRIJD_COLUMN_LETTERS, row: number): string {
  return `Wedstrijden!${WEDSTRIJD_COLUMN_LETTERS[fromColumn]}${row}:${WEDSTRIJD_COLUMN_LETTERS[toColumn]}${row}`;
}

// Veelgebruikte ranges
export const WEDSTRIJD_RANGES = {
  TEAMS: (row: number) => createWedstrijdRange('TEAM_WIT', 'TEAM_ROOD', row),
  SCORES_AND_ZLATAN: (row: number) => createWedstrijdRange('SCORE_WIT', 'ZLATAN', row),
  ALL_MATCH_DATA: (row: number) => createWedstrijdRange('ID', 'VENTIEL', row)
} as const;

// === SPELERS SHEET ===

// Kolom indices (0-based) voor array toegang
export const SPELER_COLUMNS = {
  NAME: 0,                // Kolom A - Speler naam
  POSITION: 1,            // Kolom B - Positie  
  ACTIEF: 2,             // Kolom C - Actief (boolean)
  PUSH_PERMISSION: 3,     // Kolom D - Push notificatie toestemming
  PUSH_SUBSCRIPTION: 4    // Kolom E - Push subscription data
} as const;

// Kolom letters voor spreadsheet ranges
export const SPELER_COLUMN_LETTERS = {
  NAME: 'A',
  POSITION: 'B',
  ACTIEF: 'C',
  PUSH_PERMISSION: 'D',
  PUSH_SUBSCRIPTION: 'E'
} as const;

// Helper functie om ranges te maken voor Spelers sheet
export function createSpelerRange(fromColumn: keyof typeof SPELER_COLUMN_LETTERS, toColumn: keyof typeof SPELER_COLUMN_LETTERS, row: number): string {
  return `Spelers!${SPELER_COLUMN_LETTERS[fromColumn]}${row}:${SPELER_COLUMN_LETTERS[toColumn]}${row}`;
}

// Veelgebruikte ranges voor Spelers sheet
export const SPELER_RANGES = {
  PUSH_DATA: (row: number) => createSpelerRange('PUSH_PERMISSION', 'PUSH_SUBSCRIPTION', row),
  ALL_PLAYER_DATA: (row: number) => createSpelerRange('NAME', 'PUSH_SUBSCRIPTION', row)
} as const;

// === AANWEZIGHEID SHEET ===

// Kolom indices (0-based) voor array toegang
export const AANWEZIGHEID_COLUMNS = {
  DATE: 0,        // Kolom A - Datum
  PLAYER_NAME: 1, // Kolom B - Speler naam
  STATUS: 2,      // Kolom C - Aanwezigheid status (Ja/Nee)
  TIMESTAMP: 3    // Kolom D - Timestamp (optioneel)
} as const;

// Kolom letters voor spreadsheet ranges
export const AANWEZIGHEID_COLUMN_LETTERS = {
  DATE: 'A',
  PLAYER_NAME: 'B', 
  STATUS: 'C',
  TIMESTAMP: 'D'
} as const;

// Helper functie om ranges te maken voor Aanwezigheid sheet
export function createAanwezigheidRange(fromColumn: keyof typeof AANWEZIGHEID_COLUMN_LETTERS, toColumn: keyof typeof AANWEZIGHEID_COLUMN_LETTERS, row: number): string {
  return `Aanwezigheid!${AANWEZIGHEID_COLUMN_LETTERS[fromColumn]}${row}:${AANWEZIGHEID_COLUMN_LETTERS[toColumn]}${row}`;
}

// Veelgebruikte ranges voor Aanwezigheid sheet
export const AANWEZIGHEID_RANGES = {
  ATTENDANCE_RECORD: (row: number) => createAanwezigheidRange('DATE', 'TIMESTAMP', row),
  CORE_DATA: (row: number) => createAanwezigheidRange('DATE', 'STATUS', row)
} as const;
