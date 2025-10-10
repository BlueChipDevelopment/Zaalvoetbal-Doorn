import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as webpush from 'web-push';
import { getSheetsClient } from "../shared/sheets-client";
import { SPREADSHEET_ID, APP_URLS, FIREBASE_CONFIG, SCHEDULE_PATTERNS, SHEET_NAMES, SHEET_RANGES, COLUMN_INDICES } from "../config/constants";
import { parseMatchDateToISO, parseMatchDateWithTime, toISODateString } from "../shared/date-utils";

/**
 * Scheduled function: stuur automatisch reminders 24u en 12u voor de eerstvolgende wedstrijd
 * Houdt bij in een 'ReminderLog' sheet of een reminder al is verstuurd voor een bepaalde wedstrijd en tijdstip
 */
export const scheduledAttendanceReminders = onSchedule(
  { schedule: SCHEDULE_PATTERNS.HOURLY, region: FIREBASE_CONFIG.region, timeZone: FIREBASE_CONFIG.timeZone },
  async (event) => {
    const spreadsheetId = SPREADSHEET_ID;
    const sheets = await getSheetsClient();
    const reminderSheet = SHEET_NAMES.REMINDER_LOG;
    const aanwezigheidSheet = SHEET_NAMES.AANWEZIGHEID;
    const REMINDER_HOURS = [24, 12, 4]; // 24u, 12u en 4u voor de wedstrijd

    // 1. Haal alle wedstrijden op
    const aanwezigheidResult = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${aanwezigheidSheet}!A2:A`, // A = datum
    });
    const dates = (aanwezigheidResult.data.values || []).map(r => r[COLUMN_INDICES.AANWEZIGHEID_DATUM]).filter(Boolean);

    // 2. Haal wedstrijden sheet op om te checken welke al teams hebben
    const wedstrijdenResult = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAMES.WEDSTRIJDEN}!A:F`, // A-F: alle relevante kolommen
    });
    const wedstrijdenRows = wedstrijdenResult.data.values || [];

    // Create map van wedstrijddatums die al teams hebben (kolom D en E zijn niet leeg)
    const matchesWithTeams = new Set<string>();
    for (let i = 1; i < wedstrijdenRows.length; i++) {
      const row = wedstrijdenRows[i];
      const matchDateStr = row[COLUMN_INDICES.WEDSTRIJD_DATUM] || '';
      const teamWit = row[COLUMN_INDICES.TEAM_WIT] || '';
      const teamRood = row[COLUMN_INDICES.TEAM_ROOD] || '';

      if (matchDateStr && (teamWit.trim() || teamRood.trim())) {
        // Parse Nederlandse datum formaat voor vergelijking
        const isoDateStr = parseMatchDateToISO(matchDateStr);
        if (isoDateStr) {
          matchesWithTeams.add(isoDateStr);
        }
        matchesWithTeams.add(matchDateStr); // Ook originele formaat toevoegen
      }
    }

    const now = new Date();
    let nextMatchDate: Date | null = null;
    let nextMatchDateStr: string | null = null;

    // 3. Zoek eerste toekomstige wedstrijd ZONDER teams
    for (const dateStr of dates) {
      // Parse datum met standaard tijd 20:30 in Europe/Amsterdam timezone
      const d = parseMatchDateWithTime(dateStr, '20:30:00');
      if (!d) {
        logger.warn(`Could not parse date: ${dateStr}`);
        continue;
      }

      if (d > now) {
        // Check of deze wedstrijd al teams heeft
        const isoDateStr = toISODateString(d);
        if (!matchesWithTeams.has(dateStr) && !matchesWithTeams.has(isoDateStr)) {
          nextMatchDate = d;
          nextMatchDateStr = dateStr; // Bewaar originele datum string voor logging
          logger.info(`📧 Found next match without teams: ${nextMatchDateStr}`);
          break;
        } else {
          logger.info(`⏭️ Skipping match ${dateStr} - teams already generated`);
        }
      }
    }
    if (!nextMatchDate || !nextMatchDateStr) {
      logger.info('No upcoming matches without teams found - all matches either have teams or are in the past');
      return;
    }

    logger.info(`📧 Found next match: ${nextMatchDateStr} at ${nextMatchDate.toISOString()}`);

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
      const alreadySent = reminderLogRows.some(row => row[COLUMN_INDICES.REMINDER_LOG_DATUM] === nextMatchDateStr && row[COLUMN_INDICES.REMINDER_LOG_TYPE] === reminderType);
      const msUntilMatch = nextMatchDate.getTime() - now.getTime();
      const hoursUntilMatch = msUntilMatch / (60 * 60 * 1000);

      logger.info(`📧 Checking ${reminderType} reminder: alreadySent=${alreadySent}, hoursUntilMatch=${hoursUntilMatch.toFixed(2)}, targetHours=${hoursBefore}`);

      if (alreadySent) {
        logger.info(`📧 ${reminderType} reminder already sent for ${nextMatchDateStr}`);
        continue;
      }
      // Verstuur reminder als we binnen de target uren zitten (minder dan bijv. 24u of 12u)
      if (msUntilMatch <= msBefore) { // minder dan of gelijk aan target uren voor de wedstrijd
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
            aanwezigheidRows.filter(r => r[COLUMN_INDICES.AANWEZIGHEID_DATUM] === nextMatchDateStr).map(r => r[COLUMN_INDICES.AANWEZIGHEID_NAAM])
          );

          // Create map van actieve spelers die nog niet gereageerd hebben
          const activeNotificationPlayers = new Map();
          for (let i = 1; i < spelersRows.length; i++) {
            const row = spelersRows[i];
            const playerName = row[COLUMN_INDICES.NAME];
            const isActive = row[COLUMN_INDICES.ACTIEF] === 'TRUE' || row[COLUMN_INDICES.ACTIEF] === 'Ja';

            if (isActive && !respondedNames.has(playerName)) {
              activeNotificationPlayers.set(playerName, true);
            }
          }
          logger.info(`📧 Debug: ${activeNotificationPlayers.size} active players need reminders, ${respondedNames.size} already responded, ${spelersRows.length-1} total players`);
          logger.info(`📧 Debug: Responded names: [${Array.from(respondedNames).map(n => `"${n}"`).join(', ')}]`);

          // Filter notificatie subscriptions voor actieve spelers
          const notifications: Promise<any>[] = [];
          logger.info(`📧 Debug: ${notificatiesRows.length-1} notification subscriptions found`);
          logger.info(`📧 Debug: Active players needing reminders: ${Array.from(activeNotificationPlayers.keys()).join(', ')}`);
          
          for (let i = 1; i < notificatiesRows.length; i++) {
            const row = notificatiesRows[i];
            if (row.length < 7) continue; // Skip incomplete rows

            const endpoint = row[COLUMN_INDICES.NOTIFICATIES_ENDPOINT];
            const p256dh = row[COLUMN_INDICES.NOTIFICATIES_P256DH];
            const auth = row[COLUMN_INDICES.NOTIFICATIES_AUTH];
            // userAgent = row[COLUMN_INDICES.NOTIFICATIES_USER_AGENT], timestamp = row[COLUMN_INDICES.NOTIFICATIES_TIMESTAMP] - niet gebruikt
            const active = row[COLUMN_INDICES.NOTIFICATIES_ACTIVE]?.toString().toLowerCase() === 'true';
            const playerName = row[COLUMN_INDICES.NOTIFICATIES_PLAYER_NAME];

            logger.info(`📧 Debug: Checking subscription for player: "${playerName}" (length: ${playerName?.length || 0}), active: ${active}, needsReminder: ${activeNotificationPlayers.has(playerName)}`);
            
            // Als de naam niet matcht, laten we kijken naar mogelijke alternatieven
            if (active && playerName && !activeNotificationPlayers.has(playerName)) {
              const possibleMatches = Array.from(activeNotificationPlayers.keys()).filter(name => 
                name.toLowerCase().includes(playerName.toLowerCase()) || playerName.toLowerCase().includes(name.toLowerCase())
              );
              if (possibleMatches.length > 0) {
                logger.info(`📧 Debug: Possible name matches for "${playerName}": [${possibleMatches.map(n => `"${n}"`).join(', ')}]`);
              }
            }

            // Alleen versturen naar actieve spelers die notifications willen
            if (active && playerName && activeNotificationPlayers.has(playerName)) {
              try {
                const subscription = { endpoint, keys: { p256dh, auth } };
                const payload = JSON.stringify({ title, body, url });
                notifications.push(webpush.sendNotification(subscription, payload));
                logger.info(`📧 Debug: Added notification for player ${playerName}`);
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