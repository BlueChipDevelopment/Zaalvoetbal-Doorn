import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { PlayerStats, GameStats } from '../interfaces/IGameStats';

@Injectable({
  providedIn: 'root',
})
export class GoogleSheetsService {
  private firebaseBaseUrl = environment.firebaseBaseUrl;
  private firebaseSpreadsheetId = '11xN1m371F8Tj0bX6TTRgnL_x_1_pXipox3giBuuUK1I'; // hardcoded, since only backend needs this
  private _playerStats: PlayerStats[] | null = null;

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

  getGameStatistics(): Observable<PlayerStats[]> {
    const range = 'Bewerken!A2:AZ28';
    return this.getSheetData('Bewerken').pipe(
      map(response => {
        const playerStats: { [name: string]: PlayerStats } = {};
        
        if (response) {
          const dateHeaders = response[0];

          response.slice(1).forEach((row, index) => {
            if (row[0] && row[2]?.toLowerCase() === 'ja') {
              const name = row[0];
              const stats: PlayerStats = {
                playerId: index.toString(),
                name: name,
                gamesPlayed: 0,
                wins: parseInt(row[4]) || 0,
                totalPoints: 0,
                ventielPoints: 0, // Initialize ventiel points
                gameHistory: [],
                chemistry: {}
              };

              // Iterate through each column
              dateHeaders.forEach((header, i) => {
                // Skip non-date columns
                if (i < 8) return;

                const points = parseInt(row[i]);
                if (!isNaN(points)) {
                  if (header === 'Ventiel') {
                    stats.ventielPoints = points;
                  } else if (header === 'Zlatan') {
                    stats.zlatanPoints = points;
                    stats.totalPoints += points;
                  } else {
                    // Regular game points
                    stats.gamesPlayed++;
                    stats.totalPoints += points;
                    
                    const gameStats: GameStats = {
                      date: header,
                      points: points,
                      playerIds: this.getTeamPlayersFromGame(response.slice(1), i, index)
                    };
                    stats.gameHistory.push(gameStats);
                  }
                }
              });

              stats.chemistry = this.calculatePlayerChemistry(stats.gameHistory);
              playerStats[name] = stats;
            }
          });
        }
        this._playerStats = Object.values(playerStats);
        return this._playerStats;
      })
    );
  }

  private calculatePlayerChemistry(gameHistory: GameStats[]): { [playerId: string]: { gamesPlayed: number; gamesWon: number } } {
    const chemistry: { [playerId: string]: { gamesPlayed: number; gamesWon: number } } = {};

    gameHistory.forEach(game => {
      game.playerIds.forEach(playerId => {
        if (!chemistry[playerId]) {
          chemistry[playerId] = { gamesPlayed: 0, gamesWon: 0 };
        }

        chemistry[playerId].gamesPlayed += 1; // Increment gamesPlayed

        // Count as a win if the player scored 3 points in the game
        if (game.points === 3) {
          chemistry[playerId].gamesWon += 1; // Increment gamesWon
        }
      });
    });

    return chemistry;
  }

  getPlayerStatsByName(playerName: string): any {
    if (!this._playerStats) {
      // Fetch player stats if not already cached
      this.getGameStatistics().subscribe({
        next: (stats) => {
          this._playerStats = stats;
        },
        error: (err) => {}
      });
    }

    // Check again after fetching
    if (this._playerStats) {
      const playerStat = this._playerStats.find(stat => stat.name === playerName);
      if (playerStat) {
        // Recalculate chemistry data from game history if available
        playerStat.chemistry = this.calculatePlayerChemistry(playerStat.gameHistory || []);
        return playerStat;
      }
    }

    return null;
  }

  // Synchronously get player stats (using cached data)
  getPlayerStatsByNameSync(playerName: string): any {
    // Check if we have cached stats
    if (this._playerStats) {
      const playerStat = this._playerStats.find(stat => stat.name === playerName);
      if (playerStat) {
        return playerStat;
      }
    }
    return null;
  }

  // Ensure player stats are loaded before accessing
  ensurePlayerStatsLoaded(): Observable<PlayerStats[]> {
    if (this._playerStats) {
      return new Observable(observer => {
        observer.next(this._playerStats as PlayerStats[]);
        observer.complete();
      });
    } else {
      return this.getGameStatistics();
    }
  }

  private getTeamPlayersFromGame(values: string[][], columnIndex: number, playerRowIndex: number): string[] {
    const playerIds: string[] = [];
    const playerPoints = values[playerRowIndex][columnIndex];
    
    values.forEach((row, index) => {
      if (index !== playerRowIndex && row[columnIndex] === playerPoints) {
        playerIds.push(index.toString());
      }
    });
    
    return playerIds;
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred while fetching data from Firebase Functions';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    return throwError(() => new Error(errorMessage));
  }
}