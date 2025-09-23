import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getSheetsClient } from "../shared/sheets-client";
import { setCorsHeaders } from "../shared/cors";
import { FIREBASE_CONFIG, SHEET_RANGES } from "../config/constants";

/**
 * querySheetData: Zoeken/filteren in een tabblad (eenvoudig, client-side filter)
 */
export const querySheetData = onRequest(
  { region: FIREBASE_CONFIG.region },
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
        range: `${sheetName}!${SHEET_RANGES.ALL_COLUMNS}`,
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