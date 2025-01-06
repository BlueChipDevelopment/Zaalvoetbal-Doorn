import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class GoogleSheetsService {
  private baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  private spreadsheetId = '11xN1m371F8Tj0bX6TTRgnL_x_1_pXipox3giBuuUK1I'; // Replace with your spreadsheet ID
  private apiKey = 'AIzaSyBrf7c4a5ACoI1reoq5zLYylXzpYxvokWA'; // Replace with your Google API key

  constructor(private http: HttpClient) {}

  /**
   * Fetches data from a specific range in the Google Sheet.
   * @param range The A1 notation range (e.g., "Sheet1!A1:B10").
   * @returns Observable of the sheet data.
   */
  getDataFromRange(range: string): Observable<any> {
    const url = `${this.baseUrl}/${this.spreadsheetId}/values/${range}?key=${this.apiKey}`;
    return this.http.get(url);
  }

  /**
   * Fetches a single cell's value from the Google Sheet.
   * @param cell The A1 notation of the cell (e.g., "Sheet1!A1").
   * @returns Observable of the cell data.
   */
  getDataFromCell(cell: string): Observable<any> {
    return this.getDataFromRange(cell);
  }
}