/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as webpush from 'web-push';

// Helper: Authorize Google Sheets API
async function getSheetsClient() {
  const { google } = await import("googleapis");
  const authOptions: any = {
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  };
  // Alleen lokaal een keyfile gebruiken
  if (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development') {
    authOptions.keyFile = "assets/service-account-key.json";
  }
  const auth = new google.auth.GoogleAuth(authOptions);
  const authClient = await auth.getClient();
  const projectId = await auth.getProjectId();
  let clientEmail = undefined;
  // Probeer eerst direct uit authClient
  if (authClient && typeof authClient === 'object' && 'email' in authClient) {
    clientEmail = (authClient as any).email;
  }
  // Als niet aanwezig: probeer metadata server (productie)
  if (!clientEmail) {
    try {
      const res = await (await import('node-fetch')).default(
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email',
        { headers: { 'Metadata-Flavor': 'Google' } }
      );
      if (res.ok) {
        clientEmail = await res.text();
      }
    } catch (e) {
      // negeer, log alleen als het lukt
    }
  }
  logger.info(`Google Sheets authenticatie: projectId=${projectId}, clientEmail=${clientEmail}`);
  return google.sheets({ version: "v4", auth: authClient as any });
}

// Helper: Set CORS headers for all responses
function setCorsHeaders(res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

// VAPID keys (vervang door jouw eigen sleutels!)
const VAPID_PUBLIC_KEY = 'BJPF_ap7zo3m8LviC3mOKVEW-ks2BgudLf6ZQxkoECTxcR5f6KBwCavpd2X7bcIjwTaDn8fZio1Pm5lmNtCWmhU';
const VAPID_PRIVATE_KEY = 'MmqsDhqOisjg9RoOlZHkwCW4gVNzUJ6tATLmt4jGgB8';

webpush.setVapidDetails(
  'mailto:info@zaalvoetbaldoorn.nl',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// 1. getSheetData: Ruwe data ophalen uit een specifiek tabblad
export const getSheetData = onRequest(
  { region: 'europe-west1' },
  async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    try {
      const { spreadsheetId, sheetName } = req.query;
      const sheets = await getSheetsClient();
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId as string,
        range: `${sheetName}!A:AD`,
      });
      res.json(result.data.values || []);
    } catch (error) {
      logger.error(error);
      res.status(500).send("Error fetching sheet data");
    }
  }
);

// 2. appendSheetRow: Een nieuwe rij toevoegen aan een tabblad
export const appendSheetRow = onRequest(
  { region: 'europe-west1' },
  async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    try {
      const { spreadsheetId, sheetName, row } = req.body;
      const sheets = await getSheetsClient();
      const result = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: "RAW",
        requestBody: { values: [row] },
      });
      res.json(result.data);
    } catch (error) {
      logger.error(error);
      res.status(500).send("Error appending row");
    }
  }
);

// 3. updateSheetRow: Een bestaande rij bijwerken
export const updateSheetRow = onRequest(
  { region: 'europe-west1' },
  async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    try {
      const { spreadsheetId, sheetName, rowIndex, row } = req.body;
      const sheets = await getSheetsClient();
      const range = `${sheetName}!A${rowIndex}:Z${rowIndex}`;
      const result = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: { values: [row] },
      });
      res.json(result.data);
    } catch (error) {
      logger.error(error);
      res.status(500).send("Error updating row");
    }
  }
);

// 4. batchUpdateSheet: Meerdere updates in één keer uitvoeren
export const batchUpdateSheet = onRequest(
  { region: 'europe-west1' },
  async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    try {
      const { spreadsheetId, data } = req.body; // data: [{range, values}]
      const sheets = await getSheetsClient();
      const result = await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { data, valueInputOption: "RAW" },
      });
      res.json(result.data);
    } catch (error) {
      logger.error(error);
      res.status(500).send("Error batch updating");
    }
  }
);

// 5. querySheetData: Zoeken/filteren in een tabblad (eenvoudig, client-side filter)
export const querySheetData = onRequest(
  { region: 'europe-west1' },
  async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    try {
      const { spreadsheetId, sheetName, query } = req.body;
      const sheets = await getSheetsClient();
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
      });
      const values = result.data.values || [];
      // Eenvoudig filteren op basis van query (object: {colIndex, value})
      const filtered = query
        ? values.filter((row) => row[query.colIndex] === query.value)
        : values;
      res.json(filtered);
    } catch (error) {
      logger.error(error);
      res.status(500).send("Error querying data");
    }
  }
);

// Push notification functie: stuurt een bericht naar alle spelers met toestemming
export const sendPushToAll = onRequest(
  { region: 'europe-west1' },
  async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    try {
      const spreadsheetId = '11xN1m371F8Tj0bX6TTRgnL_x_1_pXipox3giBuuUK1I';
      const sheetName = 'Spelers';
      const sheets = await getSheetsClient();
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:Z`,
      });
      const rows = result.data.values || [];
      const notifCol = 3; // D
      const subCol = 4;   // E
      const actiefCol = 2; // C (actief)
      const nameCol = 0; // A (naam)
      let targetRows = rows;
      // Filter voor reminders: alleen actieve spelers zonder aanwezigheid
      if (req.body.type === 'attendance-reminder') {
        // Haal aanwezigheid op
        const aanwezigheidResult = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `Aanwezigheid!A1:Z`,
        });
        const aanwezigheidRows = aanwezigheidResult.data.values || [];
        // Bepaal de datum van de eerstvolgende wedstrijd (uit Aanwezigheid header)
        const today = new Date();
        let nextDate: string | null = null;
        for (let i = 1; i < aanwezigheidRows.length; i++) {
          const row = aanwezigheidRows[i];
          if (row[0]) {
            const rowDate = new Date(row[0]);
            if (rowDate >= today) {
              nextDate = row[0];
              break;
            }
          }
        }
        // Verzamel namen die al gereageerd hebben voor deze datum
        const respondedNames = new Set(
          aanwezigheidRows.filter(r => r[0] === nextDate).map(r => r[1])
        );
        // Filter alleen actieve spelers zonder reactie
        targetRows = rows.filter((row, i) =>
          i > 0 &&
          row[actiefCol] === 'TRUE' &&
          row[notifCol] === 'TRUE' &&
          row[subCol] &&
          !respondedNames.has(row[nameCol])
        );
      } else {
        // Standaard: alle spelers met toestemming
        targetRows = rows.filter((row, i) =>
          i > 0 && row[notifCol] === 'TRUE' && row[subCol]
        );
      }
      const notifications: Promise<any>[] = [];
      for (const row of targetRows) {
        try {
          const subscription = JSON.parse(row[subCol]);
          const payload = JSON.stringify({
            title: req.body.title || 'Zaalvoetbal Doorn',
            body: req.body.body || 'Er is nieuws van Zaalvoetbal Doorn!',
            url: req.body.url || undefined
          });
          notifications.push(webpush.sendNotification(subscription, payload));
        } catch (err) {
          logger.error('Invalid subscription', err);
        }
      }
      await Promise.allSettled(notifications);
      res.json({ success: true, count: notifications.length });
    } catch (error) {
      logger.error(error);
      res.status(500).send('Error sending push notifications');
    }
  }
);

/**
 * Scheduled function: stuur automatisch reminders 24u en 12u voor de eerstvolgende wedstrijd
 * Houdt bij in een 'ReminderLog' sheet of een reminder al is verstuurd voor een bepaalde wedstrijd en tijdstip
 */
export const scheduledAttendanceReminders = onSchedule(
  { schedule: "every 60 minutes", region: "europe-west1" },
  async (event) => {
    const spreadsheetId = '11xN1m371F8Tj0bX6TTRgnL_x_1_pXipox3giBuuUK1I';
    const sheets = await getSheetsClient();
    const reminderSheet = 'ReminderLog';
    const aanwezigheidSheet = 'Aanwezigheid';
    const REMINDER_HOURS = [24, 12]; // 24u en 12u voor de wedstrijd

    // 1. Haal alle wedstrijden op
    const aanwezigheidResult = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${aanwezigheidSheet}!A2:A`, // A = datum
    });
    const dates = (aanwezigheidResult.data.values || []).map(r => r[0]).filter(Boolean);
    const now = new Date();
    let nextMatchDate: Date | null = null;
    let nextMatchDateStr: string | null = null;
    for (const dateStr of dates) {
      const d = new Date(dateStr);
      if (d > now) {
        nextMatchDate = d;
        nextMatchDateStr = dateStr;
        break;
      }
    }
    if (!nextMatchDate || !nextMatchDateStr) return;

    // 2. Haal ReminderLog op
    let reminderLogRows: any[][] = [];
    try {
      const logResult = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${reminderSheet}!A2:C`, // A: datum, B: type (24u/12u), C: timestamp
      });
      reminderLogRows = logResult.data.values || [];
    } catch (e) {
      // Sheet bestaat nog niet, wordt later aangemaakt
      reminderLogRows = [];
    }

    // 3. Voor elk reminder-moment: check of het tijd is en of deze al is verstuurd
    for (const hoursBefore of REMINDER_HOURS) {
      const msBefore = hoursBefore * 60 * 60 * 1000;
      const reminderType = `${hoursBefore}u`;
      const alreadySent = reminderLogRows.some(row => row[0] === nextMatchDateStr && row[1] === reminderType);
      if (alreadySent) continue;
      const msUntilMatch = nextMatchDate.getTime() - now.getTime();
      if (msUntilMatch < msBefore && msUntilMatch > msBefore - 60 * 60 * 1000) { // binnen het uur van het moment
        // 4. Stuur reminder via bestaande functie
        const title = `Reminder: geef je aanwezigheid door! (${hoursBefore}u voor de wedstrijd)`;
        const body = 'Laat even weten of je er bent bij de volgende wedstrijd.';
        const url = 'https://zaalvoetbaldoorn.nl/aanwezigheid';
        // Call sendPushToAll via HTTP (intern)
        const fetch = (await import('node-fetch')).default;
        await fetch('https://europe-west1-zaalvoetbal-doorn-74a8c.cloudfunctions.net/sendPushToAll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body, url, type: 'attendance-reminder' })
        });
        // 5. Log reminder in ReminderLog
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${reminderSheet}!A:C`,
          valueInputOption: 'RAW',
          requestBody: { values: [[nextMatchDateStr, reminderType, new Date().toISOString()]] },
        });
      }
    }
  }
);