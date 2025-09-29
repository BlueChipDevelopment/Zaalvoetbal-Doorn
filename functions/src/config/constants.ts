// Application Constants
export const SPREADSHEET_ID = '11xN1m371F8Tj0bX6TTRgnL_x_1_pXipox3giBuuUK1I';

// VAPID keys for web push notifications
export const VAPID_PUBLIC_KEY = 'BJPF_ap7zo3m8LviC3mOKVEW-ks2BgudLf6ZQxkoECTxcR5f6KBwCavpd2X7bcIjwTaDn8fZio1Pm5lmNtCWmhU';
export const VAPID_PRIVATE_KEY = 'MmqsDhqOisjg9RoOlZHkwCW4gVNzUJ6tATLmt4jGgB8';

// Application URLs
export const APP_URLS = {
  OPSTELLING: 'https://zaalvoetbal-doorn.nl/opstelling',
  AANWEZIGHEID: 'https://zaalvoetbal-doorn.nl/aanwezigheid'
} as const;

// Email for VAPID details
export const VAPID_EMAIL = 'mailto:info@zaalvoetbaldoorn.nl';

// Firebase Functions Configuration
export const FIREBASE_CONFIG = {
  region: 'europe-west1',
  timeZone: 'Europe/Amsterdam',
  baseUrl: 'https://europe-west1-zaalvoetbal-doorn-74a8c.cloudfunctions.net'
} as const;

// Google Sheets Configuration
export const SHEET_NAMES = {
  SPELERS: 'Spelers',
  AANWEZIGHEID: 'Aanwezigheid',
  WEDSTRIJDEN: 'Wedstrijden',
  NOTIFICATIES: 'Notificaties',
  REMINDER_LOG: 'ReminderLog'
} as const;

export const SHEET_RANGES = {
  ALL_COLUMNS: 'A:Z',
  EXTENDED_COLUMNS: 'A:AD',
  FIRST_COLUMNS: 'A1:Z',

  // Helper functions for dynamic ranges
  WEDSTRIJDEN_TEAMS_ROW: (rowNumber: number) => `${SHEET_NAMES.WEDSTRIJDEN}!D${rowNumber}:F${rowNumber}`
} as const;

export const SCHEDULE_PATTERNS = {
  HOURLY: 'every 60 minutes',
  DAILY_17H: '0 17 * * *'
} as const;

// Column indices for consistency
export const COLUMN_INDICES = {
  // Spelers sheet
  NAME: 0,      // A column
  POSITION: 1,  // B column
  ACTIEF: 2,    // C column

  // Wedstrijden sheet
  SEIZOEN: 1,           // B column
  WEDSTRIJD_DATUM: 2,   // C column
  TEAM_WIT: 3,          // D column
  TEAM_ROOD: 4,         // E column
  GENERATIE_METHODE: 5, // F column

  // Aanwezigheid sheet
  AANWEZIGHEID_DATUM: 0,   // A column
  AANWEZIGHEID_NAAM: 1,    // B column
  AANWEZIGHEID_STATUS: 2,  // C column

  // Notificaties sheet
  NOTIFICATIES_ENDPOINT: 0,    // A column
  NOTIFICATIES_P256DH: 1,      // B column
  NOTIFICATIES_AUTH: 2,        // C column
  NOTIFICATIES_USER_AGENT: 3,  // D column
  NOTIFICATIES_TIMESTAMP: 4,   // E column
  NOTIFICATIES_ACTIVE: 5,      // F column
  NOTIFICATIES_PLAYER_NAME: 6, // G column

  // ReminderLog sheet
  REMINDER_LOG_DATUM: 0,     // A column
  REMINDER_LOG_TYPE: 1,      // B column
  REMINDER_LOG_TIMESTAMP: 2  // C column
} as const;