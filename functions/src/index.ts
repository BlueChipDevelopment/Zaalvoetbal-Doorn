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
      logger.info('📧 Starting push notification request...');
      
      // Log request body for debugging
      logger.info('Request body:', JSON.stringify(req.body));
      
      const spreadsheetId = '11xN1m371F8Tj0bX6TTRgnL_x_1_pXipox3giBuuUK1I';
      const sheetName = 'Spelers';
      const sheets = await getSheetsClient();
      logger.info('✅ Google Sheets client created');
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:Z`,
      });
      const rows = result.data.values || [];
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
        range: `Notificaties!A1:Z`,
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
        // 4. Stuur reminder direct (zonder circulaire HTTP call)
        const title = `Reminder: geef je aanwezigheid door! (${hoursBefore}u voor de wedstrijd)`;
        const body = 'Laat even weten of je er bent bij de volgende wedstrijd.';
        const url = 'https://zaalvoetbaldoorn.nl/aanwezigheid';
        
        try {
          // Haal spelers op
          const spelersResult = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `Spelers!A1:Z`,
          });
          const spelersRows = spelersResult.data.values || [];
          const actiefCol = 2; // C (actief)
          const nameCol = 0; // A (naam)

          // Haal notificatie subscriptions op
          const notificatiesResult = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `Notificaties!A1:Z`,
          });
          const notificatiesRows = notificatiesResult.data.values || [];
          
          // Filter voor reminders: alleen actieve spelers zonder aanwezigheid
          const aanwezigheidResult = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `Aanwezigheid!A1:Z`,
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

/**
 * Scheduled function: automatisch teams genereren om 17:00 op wedstrijddagen
 * Voert volledige team generatie uit in Firebase Functions
 */
export const scheduledAutoTeamGeneration = onSchedule(
  { schedule: "0 17 * * *", region: "europe-west1" },
  async (event) => {
    logger.info('🔄 Starting scheduled auto team generation...');

    try {
      const today = new Date();
      const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Call the manual endpoint with scheduled trigger to ensure consistency
      const targetUrl = 'https://europe-west1-zaalvoetbal-doorn-74a8c.cloudfunctions.net/manualTeamGeneration';
      const urlWithParams = `${targetUrl}?date=${encodeURIComponent(dateString)}&trigger=scheduled`;

      logger.info(`📡 Calling manual team generation endpoint with scheduled trigger: ${urlWithParams}`);

      const response = await fetch(urlWithParams, {
        method: 'GET',
        headers: {
          'User-Agent': 'Firebase-Scheduler/1.0'
        }
      });

      const responseText = await response.text();

      if (response.ok) {
        const result = JSON.parse(responseText);
        if (result.success) {
          logger.info(`✅ Scheduled auto team generation completed successfully: ${result.message}`);
        } else {
          logger.info(`⚠️ Scheduled auto team generation skipped: ${result.message}`);
        }
      } else {
        logger.error(`❌ Scheduled auto team generation failed (${response.status}): ${responseText}`);
      }

    } catch (error) {
      logger.error('💥 Failed to perform scheduled auto team generation:', error);
    }
  }
);

/**
 * HTTP endpoint: handmatige team generatie (voor testing)
 */
export const manualTeamGeneration = onRequest(
  { region: 'europe-west1' },
  async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const date = req.query.date as string || new Date().toISOString().split('T')[0];
      const trigger = req.query.trigger as string || 'manual'; // Allow trigger to be specified

      logger.info(`🔄 Manual team generation triggered for ${date} (trigger: ${trigger})`);

      const result = await performAutoTeamGeneration(date, trigger);

      res.json(result);

    } catch (error) {
      logger.error('💥 Manual team generation failed:', error);
      res.status(500).json({
        success: false,
        message: `Error: ${error}`
      });
    }
  }
);

/**
 * Core team generation logic
 */
async function performAutoTeamGeneration(dateString: string, trigger: string) {
  const spreadsheetId = '11xN1m371F8Tj0bX6TTRgnL_x_1_pXipox3giBuuUK1I';
  const sheets = await getSheetsClient();

  try {
    // 1. Check if there's a match today
    logger.info(`🔍 Checking for match on ${dateString}...`);

    const wedstrijdenResult = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `Wedstrijden!A:I`,
    });
    const wedstrijdenRows = wedstrijdenResult.data.values || [];

    // Find today's match (skip header row)
    let todaysMatch: any = null;
    let matchRowNumber = -1;

    for (let i = 1; i < wedstrijdenRows.length; i++) {
      const row = wedstrijdenRows[i];
      const seizoen = row[1] || ''; // Column B
      const matchDateStr = row[2] || ''; // Column C
      const teamWit = row[3] || ''; // Column D
      const teamRood = row[4] || ''; // Column E

      // Parse date to compare (handle Dutch dd-mm-yyyy format)
      if (matchDateStr) {
        let matchDate: Date;

        // Try to parse Dutch format (dd-mm-yyyy or d-m-yyyy)
        if (matchDateStr.includes('-')) {
          const parts = matchDateStr.split('-');
          if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);

            // Create date in ISO format (year-month-day)
            matchDate = new Date(year, month - 1, day); // month is 0-indexed
          } else {
            matchDate = new Date(matchDateStr);
          }
        } else {
          matchDate = new Date(matchDateStr);
        }

        // Check if date is valid
        if (isNaN(matchDate.getTime())) {
          logger.warn(`Invalid date found in sheet: "${matchDateStr}" - skipping`);
          continue;
        }

        const matchDateString = matchDate.toISOString().split('T')[0];

        if (matchDateString === dateString) {
          // Check if teams are already generated
          if (teamWit.trim() || teamRood.trim()) {
            return {
              success: false,
              message: `Teams already generated for match on ${dateString}. Wit: "${teamWit}", Rood: "${teamRood}"`
            };
          }

          todaysMatch = { row, seizoen, matchDate: matchDateStr, rowNumber: i + 1 }; // +1 for 1-based indexing
          matchRowNumber = i + 1;
          break;
        }
      }
    }

    if (!todaysMatch) {
      return {
        success: false,
        message: `No match found for ${dateString}`
      };
    }

    logger.info(`✅ Match found for ${dateString} at row ${matchRowNumber}`);

    // 2. Get present players for today
    logger.info(`🔍 Getting present players for ${dateString}...`);

    const aanwezigheidResult = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `Aanwezigheid!A:D`,
    });
    const aanwezigheidRows = aanwezigheidResult.data.values || [];

    const presentPlayerNames: string[] = [];
    logger.info(`📅 Looking for attendance on date: ${dateString}`);

    for (let i = 1; i < aanwezigheidRows.length; i++) {
      const row = aanwezigheidRows[i];
      const attendanceDate = row[0] || '';
      const playerName = row[1] || '';
      const status = row[2] || '';

      // Debug logging for each row
      if (attendanceDate && playerName) {
        logger.info(`📋 Row ${i}: Date="${attendanceDate}", Player="${playerName}", Status="${status}"`);
      }

      if (attendanceDate === dateString && status.toLowerCase() === 'ja') {
        presentPlayerNames.push(playerName);
        logger.info(`✅ Found present player: ${playerName}`);
      }
    }

    logger.info(`👥 Total present players found: ${presentPlayerNames.length} - ${presentPlayerNames.join(', ')}`);

    if (presentPlayerNames.length < 6) {
      return {
        success: false,
        message: `Not enough players present (${presentPlayerNames.length}/6 minimum). Present: ${presentPlayerNames.join(', ')}`
      };
    }

    logger.info(`✅ ${presentPlayerNames.length} players present:`, presentPlayerNames.join(', '));

    // 3. Get player stats/ratings
    logger.info(`📊 Getting player ratings...`);

    const spelersResult = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `Spelers!A:Z`,
    });
    const spelersRows = spelersResult.data.values || [];

    // Map present players with their ratings/positions
    const playersWithStats: any[] = [];

    logger.info(`📊 Looking up stats for ${presentPlayerNames.length} present players in Spelers sheet...`);

    for (const playerName of presentPlayerNames) {
      // Find player in Spelers sheet
      let playerData = null;
      for (let i = 1; i < spelersRows.length; i++) {
        const row = spelersRows[i];
        const sheetPlayerName = row[0] || '';

        if (sheetPlayerName === playerName) { // Column A = name
          const actiefValue = row[2];
          const isActief = actiefValue === 'TRUE' || actiefValue === true || actiefValue === 'Ja' || actiefValue === 'JA';
          playerData = {
            name: playerName,
            position: row[1] || 'PLAYER', // Column B = position
            actief: isActief, // Column C = actief
            rating: 5 // Default rating - we'll need to get this from statistics
          };

          logger.info(`👤 Found player "${playerName}": position="${playerData.position}", actiefValue="${actiefValue}", actief=${isActief}`);
          break;
        }
      }

      if (!playerData) {
        logger.warn(`❌ Player "${playerName}" not found in Spelers sheet`);
      } else if (!playerData.actief) {
        logger.warn(`❌ Player "${playerName}" found but not active (actief=${playerData.actief})`);
      } else {
        playersWithStats.push(playerData);
        logger.info(`✅ Added active player "${playerName}" to team generation`);
      }
    }

    logger.info(`📈 Active players with stats: ${playersWithStats.length} - ${playersWithStats.map(p => p.name).join(', ')}`);

    // For now, use simplified team generation (we can enhance this later)
    if (playersWithStats.length < 6) {
      return {
        success: false,
        message: `Not enough active players with stats (${playersWithStats.length}/6 minimum)`
      };
    }

    // 4. Simple team generation algorithm
    logger.info(`🎯 Generating teams with ${playersWithStats.length} players`);

    // Shuffle players for random distribution
    const shuffledPlayers = [...playersWithStats].sort(() => Math.random() - 0.5);

    const teamWhite: string[] = [];
    const teamRed: string[] = [];

    // Distribute players alternately
    for (let i = 0; i < shuffledPlayers.length; i++) {
      if (i % 2 === 0) {
        teamWhite.push(shuffledPlayers[i].name);
      } else {
        teamRed.push(shuffledPlayers[i].name);
      }
    }

    const teamWhiteStr = teamWhite.join(', ');
    const teamRedStr = teamRed.join(', ');

    logger.info(`✅ Teams generated: White (${teamWhite.length}): ${teamWhiteStr}`);
    logger.info(`✅ Teams generated: Red (${teamRed.length}): ${teamRedStr}`);

    // 5. Save teams to Google Sheets
    logger.info(`💾 Saving teams to row ${matchRowNumber}...`);

    const generatieMethode = trigger === 'scheduled' ? 'Automatisch' : 'Handmatig';

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        data: [{
          range: `Wedstrijden!D${matchRowNumber}:F${matchRowNumber}`,
          values: [[teamWhiteStr, teamRedStr, generatieMethode]]
        }],
        valueInputOption: 'RAW'
      }
    });

    logger.info(`✅ Teams saved successfully to Google Sheets with generation method: ${generatieMethode}`);

    // 6. Send push notification
    logger.info(`📧 Sending push notifications...`);

    try {
      await sendTeamGenerationNotification(teamWhiteStr, teamRedStr, trigger);
      logger.info(`✅ Push notifications sent successfully`);
    } catch (notifError) {
      logger.error(`⚠️ Failed to send push notifications:`, notifError);
      // Don't fail the whole operation for notification errors
    }

    return {
      success: true,
      message: `Teams automatically generated and saved! White: ${teamWhiteStr}. Red: ${teamRedStr}.`,
      teams: {
        teamWhite: teamWhite,
        teamRed: teamRed
      },
      playersCount: playersWithStats.length,
      trigger: trigger
    };

  } catch (error) {
    logger.error(`❌ Error in performAutoTeamGeneration:`, error);
    throw error;
  }
}

/**
 * Send push notification for team generation
 */
async function sendTeamGenerationNotification(teamWhiteStr: string, teamRedStr: string, trigger: string) {
  const title = trigger === 'scheduled' ? 'Teams automatisch gegenereerd! 🤖' : 'De opstelling is bekend! ⚽';
  const body = `Wit vs Rood - Bekijk de volledige opstelling!`;
  const url = 'https://zaalvoetbaldoorn.nl/opstelling';

  const spreadsheetId = '11xN1m371F8Tj0bX6TTRgnL_x_1_pXipox3giBuuUK1I';
  const sheets = await getSheetsClient();

  // Get active players for notifications
  const spelersResult = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `Spelers!A:C`,
  });
  const spelersRows = spelersResult.data.values || [];

  // Get notification subscriptions
  const notificatiesResult = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `Notificaties!A:G`,
  });
  const notificatiesRows = notificatiesResult.data.values || [];

  // Create set of active players
  const activePlayersSet = new Set();
  for (let i = 1; i < spelersRows.length; i++) {
    const row = spelersRows[i];
    const playerName = row[0];
    const isActive = row[2] === 'TRUE';

    if (isActive && playerName) {
      activePlayersSet.add(playerName);
    }
  }

  // Send notifications to active players
  const notifications: Promise<any>[] = [];
  for (let i = 1; i < notificatiesRows.length; i++) {
    const row = notificatiesRows[i];
    if (row.length < 7) continue;

    const endpoint = row[0];
    const p256dh = row[1];
    const auth = row[2];
    const active = row[5] === 'true' || row[5] === true;
    const playerName = row[6];

    if (active && playerName && activePlayersSet.has(playerName)) {
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
  logger.info(`📧 Sent ${notifications.length} push notifications`);
}