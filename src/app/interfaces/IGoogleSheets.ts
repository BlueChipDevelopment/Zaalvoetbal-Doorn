export interface GoogleSheetsResponse {
  range: string;
  majorDimension: string;
  values: string[][];
}

export interface GoogleSheetsCellResponse {
  range: string;
  majorDimension: string;
  values: [[string]];
}