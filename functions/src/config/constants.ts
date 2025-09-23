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
  FIRST_COLUMNS: 'A1:Z'
} as const;

export const SCHEDULE_PATTERNS = {
  HOURLY: 'every 60 minutes',
  DAILY_17H: '0 17 * * *'
} as const;

// Column indices for consistency
export const COLUMN_INDICES = {
  NAME: 0,      // A column
  ACTIEF: 2     // C column
} as const;