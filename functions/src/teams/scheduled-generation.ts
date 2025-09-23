import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { FIREBASE_CONFIG, SCHEDULE_PATTERNS } from "../config/constants";

/**
 * Scheduled function: automatisch teams genereren om 17:00 op wedstrijddagen
 * Voert volledige team generatie uit in Firebase Functions
 */
export const scheduledAutoTeamGeneration = onSchedule(
  { schedule: SCHEDULE_PATTERNS.DAILY_17H, region: FIREBASE_CONFIG.region, timeZone: FIREBASE_CONFIG.timeZone },
  async (event) => {
    logger.info('🔄 Starting scheduled auto team generation...');

    try {
      const today = new Date();
      const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Call the team generation endpoint with scheduled trigger to ensure consistency
      const targetUrl = `${FIREBASE_CONFIG.baseUrl}/teamGeneration`;
      const urlWithParams = `${targetUrl}?date=${encodeURIComponent(dateString)}&trigger=scheduled`;

      logger.info(`📡 Calling team generation endpoint with scheduled trigger: ${urlWithParams}`);

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