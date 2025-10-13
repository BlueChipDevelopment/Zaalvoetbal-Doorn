import * as logger from "firebase-functions/logger";
import * as webpush from 'web-push';
import { getSheetsClient } from "../shared/sheets-client";
import { SPREADSHEET_ID, APP_URLS, SHEET_NAMES, COLUMN_INDICES } from "../config/constants";

/**
 * Send push notification for team generation
 */
export async function sendTeamGenerationNotification(teamWhiteStr: string, teamRedStr: string, trigger: string) {
  const title = 'Opstelling bekend ⚽';
  const body = `Bekijk de volledige opstelling!`;
  const url = APP_URLS.OPSTELLING;

  const spreadsheetId = SPREADSHEET_ID;
  const sheets = await getSheetsClient();

  // Get active players for notifications
  const spelersResult = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.SPELERS}!A:C`,
  });
  const spelersRows = spelersResult.data.values || [];

  // Get notification subscriptions
  const notificatiesResult = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.NOTIFICATIES}!A:G`,
  });
  const notificatiesRows = notificatiesResult.data.values || [];

  // Create set of active players
  const activePlayersSet = new Set();
  for (let i = 1; i < spelersRows.length; i++) {
    const row = spelersRows[i];
    const playerName = row[COLUMN_INDICES.NAME];
    const isActive = row[COLUMN_INDICES.ACTIEF] === 'TRUE';

    if (isActive && playerName) {
      activePlayersSet.add(playerName);
    }
  }

  // Send notifications to active players
  const notifications: Promise<any>[] = [];
  for (let i = 1; i < notificatiesRows.length; i++) {
    const row = notificatiesRows[i];
    if (row.length < 7) continue;

    const endpoint = row[COLUMN_INDICES.NOTIFICATIES_ENDPOINT];
    const p256dh = row[COLUMN_INDICES.NOTIFICATIES_P256DH];
    const auth = row[COLUMN_INDICES.NOTIFICATIES_AUTH];
    const active = row[COLUMN_INDICES.NOTIFICATIES_ACTIVE] === 'true' || row[COLUMN_INDICES.NOTIFICATIES_ACTIVE] === true;
    const playerName = row[COLUMN_INDICES.NOTIFICATIES_PLAYER_NAME];

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

  const results = await Promise.allSettled(notifications);
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  // Log failures for debugging
  if (failed > 0) {
    logger.warn(`⚠️ ${failed} team notification(s) failed to send`);
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(`Failed team notification ${index}:`, result.reason);
      }
    });
  }
  
  logger.info(`📧 Sent ${succeeded}/${notifications.length} push notifications (${failed} failed)`);
}