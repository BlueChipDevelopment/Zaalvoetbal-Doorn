import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as webpush from 'web-push';
import { getSheetsClient } from "../shared/sheets-client";
import { SPREADSHEET_ID, APP_URLS, FIREBASE_CONFIG, SCHEDULE_PATTERNS, SHEET_NAMES, SHEET_RANGES, COLUMN_INDICES } from "../config/constants";

/**
 * Scheduled function: stuur automatisch reminders 24u en 12u voor de eerstvolgende wedstrijd
 * Houdt bij in een 'ReminderLog' sheet of een reminder al is verstuurd voor een bepaalde wedstrijd en tijdstip
 */
export const scheduledAttendanceReminders = onSchedule(
  { schedule: SCHEDULE_PATTERNS.HOURLY, region: FIREBASE_CONFIG.region },
  async (event) => {
    const spreadsheetId = SPREADSHEET_ID;
    const sheets = await getSheetsClient();
    const reminderSheet = SHEET_NAMES.REMINDER_LOG;
    const aanwezigheidSheet = SHEET_NAMES.AANWEZIGHEID;
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
        // 4. Stuur reminder direct (zonder circulaire HTTP call)
        const title = 'Aanwezigheidsreminder';
        const body = 'Laat even weten of je er bent bij de volgende wedstrijd.';
        const url = APP_URLS.AANWEZIGHEID;

        try {
          // Haal spelers op
          const spelersResult = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_NAMES.SPELERS}!${SHEET_RANGES.FIRST_COLUMNS}`,
          });
          const spelersRows = spelersResult.data.values || [];
          const actiefCol = COLUMN_INDICES.ACTIEF; // C (actief)
          const nameCol = COLUMN_INDICES.NAME; // A (naam)

          // Haal notificatie subscriptions op
          const notificatiesResult = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_NAMES.NOTIFICATIES}!${SHEET_RANGES.FIRST_COLUMNS}`,
          });
          const notificatiesRows = notificatiesResult.data.values || [];

          // Filter voor reminders: alleen actieve spelers zonder aanwezigheid
          const aanwezigheidResult = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_NAMES.AANWEZIGHEID}!${SHEET_RANGES.FIRST_COLUMNS}`,
          });
          const aanwezigheidRows = aanwezigheidResult.data.values || [];

          // Verzamel namen die al gereageerd hebben voor deze datum
          const respondedNames = new Set(
            aanwezigheidRows.filter(r => r[0] === nextMatchDateStr).map(r => r[1])
          );

          // Create map van actieve spelers die nog niet gereageerd hebben
          const activeNotificationPlayers = new Map();
          for (let i = 1; i < spelersRows.length; i++) {
            const row = spelersRows[i];
            const playerName = row[nameCol];
            const isActive = row[actiefCol] === 'TRUE';

            if (isActive && !respondedNames.has(playerName)) {
              activeNotificationPlayers.set(playerName, true);
            }
          }

          // Filter notificatie subscriptions voor actieve spelers
          const notifications: Promise<any>[] = [];
          for (let i = 1; i < notificatiesRows.length; i++) {
            const row = notificatiesRows[i];
            if (row.length < 7) continue; // Skip incomplete rows

            const endpoint = row[0];
            const p256dh = row[1];
            const auth = row[2];
            // userAgent = row[3], timestamp = row[4] - niet gebruikt
            const active = row[5] === 'true' || row[5] === true;
            const playerName = row[6];

            // Alleen versturen naar actieve spelers die notifications willen
            if (active && playerName && activeNotificationPlayers.has(playerName)) {
              try {
                const subscription = { endpoint, keys: { p256dh, auth } };
                const payload = JSON.stringify({ title, body, url });
                notifications.push(webpush.sendNotification(subscription, payload));
              } catch (err) {
                logger.error('Invalid subscription for player', playerName, err);
              }
            }
          }
          await Promise.allSettled(notifications);
          logger.info(`📧 Sent ${notifications.length} reminder notifications for ${hoursBefore}h reminder`);
        } catch (error) {
          logger.error(`❌ Failed to send reminder notifications:`, error);
        }
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