import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getSheetsClient } from "../shared/sheets-client";
import { setCorsHeaders } from "../shared/cors";
import { FIREBASE_CONFIG } from "../config/constants";

/**
 * batchUpdateSheet: Meerdere updates in één keer uitvoeren
 */
export const batchUpdateSheet = onRequest(
  { region: FIREBASE_CONFIG.region },
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