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

  getLeaderboard(): Observable<PlayerStats[]> {
    return this.googleSheetsService.getGameStatistics().pipe(
      map(players => {
        // Sort players by total points, then by average per game if points are equal
        return players.sort((a, b) => {
          if (b.totalPoints === a.totalPoints) {
            return (b.totalPoints / b.gamesPlayed) - (a.totalPoints / a.gamesPlayed);
          }
          return b.totalPoints - a.totalPoints;
        });
      })
    );
  }

  getBestTeammates(playerId: string): Observable<{playerId: string, chemistry: number, gamesPlayed: number, gamesWon: number}[]> {
    return this.googleSheetsService.getGameStatistics().pipe(
      map(players => {
        const player = players.find(p => p.playerId === playerId);
        if (!player) return [];

        return Object.entries(player.chemistry)
          .map(([id, stats]) => {
            const chemistryScore = stats.gamesPlayed > 0 ? stats.gamesWon / stats.gamesPlayed : 0;
            return {
              playerId: id,
              chemistry: chemistryScore, // Use a numeric chemistry score for sorting
              gamesPlayed: stats.gamesPlayed,
              gamesWon: stats.gamesWon
            };
          })
          .sort((a, b) => b.chemistry - a.chemistry); // Sort by numeric chemistry score
      })
    );
  }

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