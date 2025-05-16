import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

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
  getLatestTeams(): Observable<any> {
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