import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SPELER_COLUMNS } from '../constants/sheet-columns';

@Injectable({
  providedIn: 'root',
})
export class GoogleSheetsService {
  private firebaseBaseUrl = environment.firebaseBaseUrl;
  private firebaseSpreadsheetId = '11xN1m371F8Tj0bX6TTRgnL_x_1_pXipox3giBuuUK1I';

  constructor(private http: HttpClient) {
    if (!this.firebaseBaseUrl || !this.firebaseSpreadsheetId) {
      throw new Error('Firebase configuration is incomplete. Check your environment variables.');
    }
  }

  get spreadsheetId(): string {
    return this.firebaseSpreadsheetId;
  }

  getSheetData(sheetName: string): Observable<any[][]> {
    const url = `${this.firebaseBaseUrl}/getSheetData?spreadsheetId=${this.firebaseSpreadsheetId}&sheetName=${encodeURIComponent(sheetName)}`;
    return this.http.get<any[][]>(url).pipe(
      catchError(this.handleError)
    );
  }

  appendSheetRow(sheetName: string, row: any[]): Observable<any> {
    const url = `${this.firebaseBaseUrl}/appendSheetRow`;
    return this.http.post<any>(url, {
      spreadsheetId: this.firebaseSpreadsheetId,
      sheetName,
      row
    }).pipe(
      catchError(this.handleError)
    );
  }

  updateSheetRow(sheetName: string, rowIndex: number, row: any[]): Observable<any> {
    const url = `${this.firebaseBaseUrl}/updateSheetRow`;
    return this.http.post<any>(url, {
      spreadsheetId: this.firebaseSpreadsheetId,
      sheetName,
      rowIndex,
      row
    }).pipe(
      catchError(this.handleError)
    );
  }

  batchUpdateSheet(data: { range: string, values: any[][] }[]): Observable<any> {
    const url = `${this.firebaseBaseUrl}/batchUpdateSheet`;
    return this.http.post<any>(url, {
      spreadsheetId: this.firebaseSpreadsheetId,
      data
    }).pipe(
      catchError(this.handleError)
    );
  }

  querySheetData(sheetName: string, query: { colIndex: number, value: any }): Observable<any[][]> {
    const url = `${this.firebaseBaseUrl}/querySheetData`;
    return this.http.post<any[][]>(url, {
      spreadsheetId: this.firebaseSpreadsheetId,
      sheetName,
      query
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get the latest teams from a dedicated sheet or range
   */
  getOpstelling(): Observable<any> {
    // Adjust the sheet/range as needed for your setup
    const url = `${this.firebaseBaseUrl}/getSheetData?spreadsheetId=${this.firebaseSpreadsheetId}&sheetName=LaatsteTeams`;
    return this.http.get<any[][]>(url).pipe(
      map((data: any[][]) => {
        // Transform the sheet data into Teams structure
        // Example assumes: [ [teamName, player1, player2, ...], ... ]
        if (!data || data.length < 2) return null;
        const [whiteRow, redRow] = data;
        return {
          teamWhite: {
            name: whiteRow[0],
            squad: whiteRow.slice(1).map((name: string) => ({ name, rating: 0 })),
            sumOfRatings: 0,
            totalScore: 0,
            shirtcolor: 'white',
            attack: 0,
            defense: 0,
            condition: 0,
            chemistryScore: 0
          },
          teamRed: {
            name: redRow[0],
            squad: redRow.slice(1).map((name: string) => ({ name, rating: 0 })),
            sumOfRatings: 0,
            totalScore: 0,
            shirtcolor: 'red',
            attack: 0,
            defense: 0,
            condition: 0,
            chemistryScore: 0
          }
        };
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Update push subscription and notification permission for a player (by row index) on the Spelers sheet
   * @param rowIndex 0-based index (excluding header)
   * @param pushSubscription JSON-stringified push subscription
   * @param pushPermission true/false
   */
  updatePlayerPushSubscription(playerName: string, pushSubscription: string, pushPermission: boolean): Observable<any> {
    const sheetName = 'Spelers';
    return this.getSheetData(sheetName).pipe(
      map(rows => {
        // Find the player by name in the actual sheet data
        let foundRowIndex = -1;
        let foundRow: any[] | null = null;
        
        for (let i = 1; i < rows.length; i++) { // Skip header row (index 0)
          const row = rows[i];
          if (row && row[0] && row[0].toLowerCase().trim() === playerName.toLowerCase().trim()) {
            foundRowIndex = i;
            foundRow = row;
            break;
          }
        }
        
        if (!foundRow || foundRowIndex === -1) {
          throw new Error(`Player not found in sheet: ${playerName}`);
        }
        
        foundRow[SPELER_COLUMNS.PUSH_PERMISSION] = pushPermission ? 'TRUE' : 'FALSE'; // Kolom D
        foundRow[SPELER_COLUMNS.PUSH_SUBSCRIPTION] = pushSubscription; // Kolom E
        
        const sheetRowNumber = foundRowIndex + 1; // Convert to 1-based indexing
        return { row: foundRow, sheetRowNumber };
      }),
      switchMap(({row, sheetRowNumber}) => {
        return this.updateSheetRow(sheetName, sheetRowNumber, row);
      }),
      catchError(error => {
        console.error('❌ GoogleSheetsService error:', error);
        throw error;
      })
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred while fetching data from Firebase Functions';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}