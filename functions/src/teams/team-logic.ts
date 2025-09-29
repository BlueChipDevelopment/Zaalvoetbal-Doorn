import * as logger from "firebase-functions/logger";
import { getSheetsClient } from "../shared/sheets-client";
import { SPREADSHEET_ID, SHEET_NAMES, SHEET_RANGES, COLUMN_INDICES } from "../config/constants";
import { sendTeamGenerationNotification } from "./team-notification";
import { parseMatchDate, toISODateString } from "../shared/date-utils";

/**
 * Core team generation logic
 */
export async function performAutoTeamGeneration(dateString: string, trigger: string) {
  const spreadsheetId = SPREADSHEET_ID;
  const sheets = await getSheetsClient();

  try {
    // 1. Check if there's a match today
    logger.info(`🔍 Checking for match on ${dateString}...`);

    const wedstrijdenResult = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAMES.WEDSTRIJDEN}!A:I`,
    });
    const wedstrijdenRows = wedstrijdenResult.data.values || [];

    // Find today's match (skip header row)
    let todaysMatch: any = null;
    let matchRowNumber = -1;

    for (let i = 1; i < wedstrijdenRows.length; i++) {
      const row = wedstrijdenRows[i];
      const seizoen = row[COLUMN_INDICES.SEIZOEN] || '';
      const matchDateStr = row[COLUMN_INDICES.WEDSTRIJD_DATUM] || '';
      const teamWit = row[COLUMN_INDICES.TEAM_WIT] || '';
      const teamRood = row[COLUMN_INDICES.TEAM_ROOD] || '';

      // Parse date to compare (handle Dutch dd-mm-yyyy format)
      if (matchDateStr) {
        const matchDate = parseMatchDate(matchDateStr);
        if (!matchDate) {
          logger.warn(`Invalid date found in sheet: "${matchDateStr}" - skipping`);
          continue;
        }

        const matchDateString = toISODateString(matchDate);

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
      range: `${SHEET_NAMES.AANWEZIGHEID}!A:D`,
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
      range: `${SHEET_NAMES.SPELERS}!${SHEET_RANGES.ALL_COLUMNS}`,
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
          range: SHEET_RANGES.WEDSTRIJDEN_TEAMS_ROW(matchRowNumber),
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