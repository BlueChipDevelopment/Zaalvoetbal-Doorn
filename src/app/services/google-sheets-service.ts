import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class GoogleSheetsService {
  private baseUrl = environment.googleSheetsBaseUrl;
  private spreadsheetId = environment.googleSheetsSpreadsheetId;
  private apiKey = environment.googleApiKey;

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