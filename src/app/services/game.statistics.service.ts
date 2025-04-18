import { Injectable } from '@angular/core';
import { Player } from '../interfaces/IPlayer';
import { Positions } from '../enums/positions.enum';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { GoogleSheetsService } from './google-sheets-service';

@Injectable({
  providedIn: 'root'
})
export class GameStatisticsService {
  private ratingsCache: Player[] | null = null;
  private cacheTimestamp: number | null = null;
  private cacheDurationMs = 5 * 60 * 1000; // 5 minuten

  constructor(private googleSheetsService: GoogleSheetsService) {}

  getPlayersWithCalculatedRatings(): Observable<Player[]> {
    const now = Date.now();
    if (this.ratingsCache && this.cacheTimestamp && (now - this.cacheTimestamp < this.cacheDurationMs)) {
      return new Observable(observer => {
        observer.next(this.ratingsCache!);
        observer.complete();
      });
    }
    return forkJoin({
      spelers: this.googleSheetsService.getSheetData('Spelers'),
      wedstrijden: this.googleSheetsService.getSheetData('Wedstrijden')
    }).pipe(
      map(({ spelers, wedstrijden }) => {
        // Filter actieve spelers
        const actieveSpelers = (spelers || []).filter(row => row[0] && row[2]?.toLowerCase() === 'ja');
        // Maak een map van actieve spelers op genormaliseerde naam
        const actieveSpelersMap: { [naam: string]: any } = {};
        actieveSpelers.forEach((row: any) => {
          actieveSpelersMap[row[0].trim().toLowerCase()] = row;
        });
        // Bereken rating per speler op basis van wedstrijden
        const spelerStats: { [naam: string]: { gamesPlayed: number, totalPoints: number } } = {};
        (wedstrijden || []).forEach(match => {
          const teamWhitePlayers = (match[2] || '').split(',').map((p: string) => p.trim().toLowerCase()).filter(Boolean);
          const teamRedPlayers = (match[3] || '').split(',').map((p: string) => p.trim().toLowerCase()).filter(Boolean);
          const teamWhitePoints = parseInt(match[4]) > parseInt(match[5]) ? 3 : parseInt(match[4]) === parseInt(match[5]) ? 2 : 1;
          const teamRedPoints = parseInt(match[5]) > parseInt(match[4]) ? 3 : parseInt(match[5]) === parseInt(match[4]) ? 2 : 1;
          teamWhitePlayers.forEach((player: string) => {
            if (!spelerStats[player]) spelerStats[player] = { gamesPlayed: 0, totalPoints: 0 };
            spelerStats[player].gamesPlayed++;
            spelerStats[player].totalPoints += teamWhitePoints;
          });
          teamRedPlayers.forEach((player: string) => {
            if (!spelerStats[player]) spelerStats[player] = { gamesPlayed: 0, totalPoints: 0 };
            spelerStats[player].gamesPlayed++;
            spelerStats[player].totalPoints += teamRedPoints;
          });
        });
        const maxPoints = Math.max(...Object.values(spelerStats).map(s => s.totalPoints), 1);
        // Maak Player[] met rating, altijd op basis van actieve spelers
        const result = Object.values(actieveSpelersMap).map((row: any) => {
          const naam = row[0].trim().toLowerCase();
          const stats = spelerStats[naam] || { gamesPlayed: 0, totalPoints: 0 };
          let rating = Math.round((stats.totalPoints / (maxPoints / 10)));
          rating = Math.max(1, Math.min(10, rating));
          return {
            name: row[0],
            position: row[1] === 'Keeper' ? Positions.GOAL_KEEPER.toString() : Positions.MIDFIELDER.toString(),
            rating
          } as Player;
        });
        this.ratingsCache = result;
        this.cacheTimestamp = Date.now();
        return result;
      })
    );
  }

  getPlayerStatsByName(playerName: string): Player | null {
    const now = Date.now();
    if (this.ratingsCache && this.cacheTimestamp && (now - this.cacheTimestamp < this.cacheDurationMs)) {
      return this.ratingsCache.find(p => p.name === playerName) || null;
    }
    // Geen cache: synchroniseer ophalen (let op: asynchroon is beter, maar voor compatibiliteit)
    let found: Player | null = null;
    this.getPlayersWithCalculatedRatings().subscribe(players => {
      found = players.find(p => p.name === playerName) || null;
    });
    return found;
  }
}
