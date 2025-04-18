import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { GoogleSheetsService } from './google-sheets-service';
import { PlayerStats } from '../interfaces/IGameStats';

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {
  constructor(private googleSheetsService: GoogleSheetsService) {}

  getExtraLeaderboard(): Observable<any[]> {
    return this.googleSheetsService.getSheetData('Wedstrijden').pipe(
      map(data => {
        return data.map(row => {
          return {
            matchNumber: row[0],
            date: row[1].split('-').reverse().join('-'), // Convert DD-MM-YYYY to YYYY-MM-DD for proper sorting
            teamWhitePlayers: row[2],
            teamRedPlayers: row[3],
            teamWhiteGoals: row[4],
            teamRedGoals: row[5],
            zlatanPlayer: row[6],
            ventielPlayer: row[7],
            teamWhitePoints: row[4] > row[5] ? 3 : row[4] === row[5] ? 2 : 1,
            teamRedPoints: row[5] > row[4] ? 3 : row[5] === row[4] ? 2 : 1
          };
        });
      })
    );
  }
}