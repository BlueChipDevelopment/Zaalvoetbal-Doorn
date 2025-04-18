/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

// Helper: Authorize Google Sheets API
async function getSheetsClient() {
  const { google } = await import("googleapis");
  const auth = new google.auth.GoogleAuth({
    keyFile: "assets/service-account-key.json", // gebruik het service account bestand
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  // Force JWT client for Sheets API compatibility
  const authClient = await auth.getClient();
  // Cast to any to avoid type issues with new Google Auth clients
  return google.sheets({ version: "v4", auth: authClient as any });
}

// Helper: Set CORS headers for all responses
function setCorsHeaders(res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

const europe = { region: "europe-west1" };

// 1. getSheetData: Ruwe data ophalen uit een specifiek tabblad
export const getSheetData = onRequest(
  europe,
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
  europe,
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
  europe,
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
  europe,
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
  europe,
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
