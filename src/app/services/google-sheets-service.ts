import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { GoogleSheetsResponse, GoogleSheetsCellResponse } from '../interfaces/IGoogleSheets';

@Injectable({
  providedIn: 'root',
})
export class GoogleSheetsService {
  private baseUrl = environment.googleSheetsBaseUrl;
  private spreadsheetId = environment.googleSheetsSpreadsheetId;
  private apiKey = environment.googleApiKey;

  constructor(private http: HttpClient) {
    if (!this.baseUrl || !this.spreadsheetId || !this.apiKey) {
      throw new Error('Google Sheets configuration is incomplete. Check your environment variables.');
    }
  }

  /**
   * Fetches data from a specific range in the Google Sheet.
   * @param range The A1 notation range (e.g., "Sheet1!A1:B10").
   * @returns Observable of the sheet data.
   */
  getDataFromRange(range: string): Observable<GoogleSheetsResponse> {
    const url = `${this.baseUrl}/${this.spreadsheetId}/values/${range}?key=${this.apiKey}`;
    return this.http.get<GoogleSheetsResponse>(url).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Fetches a single cell's value from the Google Sheet.
   * @param cell The A1 notation of the cell (e.g., "Sheet1!A1").
   * @returns Observable of the cell data.
   */
  getDataFromCell(cell: string): Observable<GoogleSheetsCellResponse> {
    return this.http.get<GoogleSheetsCellResponse>(`${this.baseUrl}/${this.spreadsheetId}/values/${cell}?key=${this.apiKey}`).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred while fetching data from Google Sheets';
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}