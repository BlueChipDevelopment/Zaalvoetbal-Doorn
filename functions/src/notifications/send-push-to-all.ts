import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as webpush from 'web-push';
import { getSheetsClient } from "../shared/sheets-client";
import { setCorsHeaders } from "../shared/cors";
import { SPREADSHEET_ID, FIREBASE_CONFIG, SHEET_NAMES, SHEET_RANGES, COLUMN_INDICES } from "../config/constants";
import { parseMatchDate } from "../shared/date-utils";

/**
 * Push notification functie: stuurt een bericht naar alle spelers met toestemming
 */
export const sendPushToAll = onRequest(
  { region: FIREBASE_CONFIG.region },
  async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    try {
      logger.info('📧 Starting push notification request...');

      // Log request body for debugging
      logger.info('Request body:', JSON.stringify(req.body));

      const spreadsheetId = SPREADSHEET_ID;
      const sheetName = SHEET_NAMES.SPELERS;
      const sheets = await getSheetsClient();
      logger.info('✅ Google Sheets client created');
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!${SHEET_RANGES.FIRST_COLUMNS}`,
      });
      const rows = result.data.values || [];
      const actiefCol = COLUMN_INDICES.ACTIEF; // C (actief)
      const nameCol = COLUMN_INDICES.NAME; // A (naam)
      let targetRows = rows;
      // Filter voor reminders: alleen actieve spelers zonder aanwezigheid
      if (req.body.type === 'attendance-reminder') {
        // Haal aanwezigheid op
        const aanwezigheidResult = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${SHEET_NAMES.AANWEZIGHEID}!${SHEET_RANGES.FIRST_COLUMNS}`,
        });
        const aanwezigheidRows = aanwezigheidResult.data.values || [];
        // Bepaal de datum van de eerstvolgende wedstrijd (uit Aanwezigheid header)
        const today = new Date();
        let nextDate: string | null = null;
        for (let i = 1; i < aanwezigheidRows.length; i++) {
          const row = aanwezigheidRows[i];
          const dateStr = row[COLUMN_INDICES.AANWEZIGHEID_DATUM];
          if (dateStr) {
            const rowDate = parseMatchDate(dateStr);
            if (rowDate && rowDate >= today) {
              nextDate = dateStr;
              break;
            }
          }
        }
        // Verzamel namen die al gereageerd hebben voor deze datum
        const respondedNames = new Set(
          aanwezigheidRows.filter(r => r[COLUMN_INDICES.AANWEZIGHEID_DATUM] === nextDate).map(r => r[COLUMN_INDICES.AANWEZIGHEID_NAAM])
        );
        // Filter alleen actieve spelers zonder reactie
        targetRows = rows.filter((row, i) =>
          i > 0 &&
          (row[actiefCol] === 'TRUE' || row[actiefCol] === 'Ja') &&
          !respondedNames.has(row[nameCol])
        );
      } else {
        // Standaard: alle actieve spelers
        targetRows = rows.filter((row, i) =>
          i > 0 && (row[actiefCol] === 'TRUE' || row[actiefCol] === 'Ja')
        );
      }
      // Nu notifications versturen vanuit Notificaties sheet
      // Haal notificatie subscriptions op
      const notificatiesResult = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_NAMES.NOTIFICATIES}!${SHEET_RANGES.FIRST_COLUMNS}`,
      });
      const notificatiesRows = notificatiesResult.data.values || [];

      // Create map van target spelers
      const targetPlayerNames = new Set(targetRows.map(row => row[nameCol]));

      const notifications: Promise<any>[] = [];
      for (let i = 1; i < notificatiesRows.length; i++) {
        const row = notificatiesRows[i];
        if (row.length < 7) continue; // Skip incomplete rows

        const endpoint = row[0];
        const p256dh = row[1];
        const auth = row[2];
        const active = row[5] === 'true' || row[5] === true || row[5] === 'TRUE';
        const playerName = row[6];

        // Voor test berichten: verstuur naar alle actieve subscriptions
        // Voor andere berichten: alleen naar target spelers
        const isTestMessage = req.body.type === 'test' || !req.body.type;
        const shouldSend = active && playerName && (isTestMessage || targetPlayerNames.has(playerName));

        // Debug logging
        logger.info(`📧 Processing notification row ${i}: player=${playerName}, active=${row[5]} (${active}), isTest=${isTestMessage}, shouldSend=${shouldSend}`);

        if (shouldSend) {
          try {
            const subscription = { endpoint, keys: { p256dh, auth } };
            const payload = JSON.stringify({
              title: req.body.title || 'Zaalvoetbal Doorn',
              body: req.body.body || 'Er is nieuws van Zaalvoetbal Doorn!',
              url: req.body.url || undefined
            });
            notifications.push(webpush.sendNotification(subscription, payload));
          } catch (err) {
            logger.error('Invalid subscription for player', playerName, err);
          }
        }
      }

      await Promise.allSettled(notifications);
      logger.info(`📧 Sent ${notifications.length} push notifications successfully`);
      res.json({ success: true, count: notifications.length });
    } catch (error) {
      logger.error(error);
      res.status(500).send('Error sending push notifications');
    }
  }
);