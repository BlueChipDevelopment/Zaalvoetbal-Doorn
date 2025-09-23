import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getSheetsClient } from "../shared/sheets-client";
import { setCorsHeaders } from "../shared/cors";
import { FIREBASE_CONFIG, SHEET_RANGES } from "../config/constants";

/**
 * getSheetData: Ruwe data ophalen uit een specifiek tabblad
 */
export const getSheetData = onRequest(
  { region: FIREBASE_CONFIG.region },
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
        range: `${sheetName}!${SHEET_RANGES.EXTENDED_COLUMNS}`,
      });
      res.json(result.data.values || []);
    } catch (error) {
      logger.error(error);
      res.status(500).send("Error fetching sheet data");
    }
  }
);