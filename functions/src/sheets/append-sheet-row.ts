import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getSheetsClient } from "../shared/sheets-client";
import { setCorsHeaders } from "../shared/cors";
import { FIREBASE_CONFIG, SHEET_RANGES } from "../config/constants";

/**
 * appendSheetRow: Een nieuwe rij toevoegen aan een tabblad
 */
export const appendSheetRow = onRequest(
  { region: FIREBASE_CONFIG.region },
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
        range: `${sheetName}!${SHEET_RANGES.ALL_COLUMNS}`,
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