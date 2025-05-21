import { Injectable } from '@angular/core';
import { Player } from '../interfaces/IPlayer';
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

  getPlayerStatsByName(playerName: string): Player | undefined {
    const now = Date.now();
    if (this.ratingsCache && this.cacheTimestamp && (now - this.cacheTimestamp < this.cacheDurationMs)) {
      return this.ratingsCache.find(p => p.name === playerName);
    }
    // Geen cache: synchroniseer ophalen (let op: asynchroon is beter, maar voor compatibiliteit)
    let found: Player | undefined = undefined;
    this.getFullPlayerStats().subscribe(players => {
      found = players.find(p => p.name === playerName);
    });
    return found;
  }

  /**
   * Geeft uitgebreide statistieken voor alle spelers, incl. gamesPlayed, totalPoints, wins, losses, ties, rating, winRatio, gameHistory, zlatanPoints, ventielPoints
   */
  getFullPlayerStats(): Observable<Player[]> {
    return forkJoin({
      spelers: this.googleSheetsService.getSheetData('Spelers'),
      wedstrijden: this.googleSheetsService.getSheetData('Wedstrijden')
    }).pipe(
      map(({ spelers, wedstrijden }) => {
        // Sla de header over (eerste rij) in spelers
        const spelersData = (spelers || []).slice(1);
        const actieveSpelers = spelersData.filter(row => row[0] && row[2]?.toLowerCase() === 'ja');
        const actieveSpelersMap: { [naam: string]: any } = {};
        actieveSpelers.forEach((row: any) => {
          actieveSpelersMap[row[0].trim().toLowerCase()] = row;
        });
        const geldigeWedstrijden = (wedstrijden || []).filter(match => {
          const wit = match[4];
          const rood = match[5];
          return wit != null && wit !== '' && rood != null && rood !== '';
        });
        // Sorteer geldigeWedstrijden op datum (oud -> nieuw) zodat gameHistory altijd chronologisch is
        const geldigeWedstrijdenSorted = [...geldigeWedstrijden].sort((a, b) => {
          // Verwacht: match[1] is datum in DD-MM-YYYY of YYYY-MM-DD
          const parseDate = (d: string) => {
            const parts = d.split('-');
            if (parts.length === 3) {
              if (parts[0].length === 4) {
                // YYYY-MM-DD
                return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
              } else {
                // DD-MM-YYYY
                return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
              }
            }
            return new Date(d);
          };
          return parseDate(a[1]).getTime() - parseDate(b[1]).getTime();
        });
        // Statistieken per speler
        const playerStats: { [player: string]: { gamesPlayed: number; totalPoints: number; wins: number; losses: number; ties: number; gameHistory: any[]; zlatanPoints: number; ventielPoints: number } } = {};
        geldigeWedstrijdenSorted.forEach(match => {
          const teamWhitePlayers = (match[2] || '').split(',').map((p: string) => p.trim().toLowerCase()).filter((p: string) => p && p !== 'team wit');
          const teamRedPlayers = (match[3] || '').split(',').map((p: string) => p.trim().toLowerCase()).filter((p: string) => p && p !== 'team rood');
          const allPlayers = [...teamWhitePlayers, ...teamRedPlayers];
          const teamWhiteGoals = parseInt(match[4]);
          const teamRedGoals = parseInt(match[5]);
          // White
          teamWhitePlayers.forEach((player: string) => {
            if (!playerStats[player]) playerStats[player] = { gamesPlayed: 0, totalPoints: 0, wins: 0, losses: 0, ties: 0, gameHistory: [], zlatanPoints: 0, ventielPoints: 0 };
            playerStats[player].gamesPlayed++;
            if (teamWhiteGoals > teamRedGoals) playerStats[player].wins++;
            else if (teamWhiteGoals < teamRedGoals) playerStats[player].losses++;
            else playerStats[player].ties++;
            playerStats[player].gameHistory.push({
              result: teamWhiteGoals > teamRedGoals ? 3 : teamWhiteGoals === teamRedGoals ? 2 : 1,
              date: match[1],
              playerIds: allPlayers
            });
            if (match[6] && match[6].trim().toLowerCase() === player) {
              playerStats[player].zlatanPoints = (playerStats[player].zlatanPoints || 0) + 1;
            }
            if (match[7] && match[7].trim().toLowerCase() === player) {
              playerStats[player].ventielPoints = (playerStats[player].ventielPoints || 0) + 1;
            }
          });
          // Red
          teamRedPlayers.forEach((player: string) => {
            if (!playerStats[player]) playerStats[player] = { gamesPlayed: 0, totalPoints: 0, wins: 0, losses: 0, ties: 0, gameHistory: [], zlatanPoints: 0, ventielPoints: 0 };
            playerStats[player].gamesPlayed++;
            if (teamRedGoals > teamWhiteGoals) playerStats[player].wins++;
            else if (teamRedGoals < teamWhiteGoals) playerStats[player].losses++;
            else playerStats[player].ties++;
            playerStats[player].gameHistory.push({
              result: teamRedGoals > teamWhiteGoals ? 3 : teamRedGoals === teamWhiteGoals ? 2 : 1,
              date: match[1],
              playerIds: allPlayers
            });
            if (match[6] && match[6].trim().toLowerCase() === player) {
              playerStats[player].zlatanPoints = (playerStats[player].zlatanPoints || 0) + 1;
            }
            if (match[7] && match[7].trim().toLowerCase() === player) {
              playerStats[player].ventielPoints = (playerStats[player].ventielPoints || 0) + 1;
            }
          });
        });
        // Voeg spelers toe die in de Spelers-lijst staan maar nog geen wedstrijden hebben gespeeld
        spelersData.forEach((row: any) => {
          const naam = row[0]?.trim().toLowerCase();
          if (naam && !playerStats[naam]) {
            playerStats[naam] = {
              gamesPlayed: 0,
              totalPoints: 0,
              wins: 0,
              losses: 0,
              ties: 0,
              gameHistory: [],
              zlatanPoints: 0,
              ventielPoints: 0
            };
          }
        });
        // Total points en max
        Object.values(playerStats).forEach((stats: any) => {
          stats.totalPoints = (stats.wins * 3) + (stats.ties * 2) + (stats.losses * 1) + (stats.zlatanPoints || 0);
        });
        const maxTotalPoints = Math.max(...Object.values(playerStats).map((stats: any) => stats.totalPoints || 0), 1);
        // Maak array met alle info
        return Object.entries(playerStats).map(([player, stats]) => {
          // Zoek altijd de spelerRow op in de originele spelerslijst (zonder header)
          const spelerRow = spelersData.find((row: any) => row[0] && row[0].trim().toLowerCase() === player);
          let rating = Math.round((stats.totalPoints / (maxTotalPoints / 10)));
          rating = Math.max(1, Math.min(10, rating));
          return {
            name: spelerRow ? spelerRow[0] : player,
            position: spelerRow ? spelerRow[1] : null, // 2e kolom is positie
            rating: rating,
            gamesPlayed: stats.gamesPlayed,
            totalPoints: stats.totalPoints,
            wins: stats.wins,
            losses: stats.losses,
            ties: stats.ties,
            winRatio: stats.gamesPlayed > 0 ? (stats.wins / stats.gamesPlayed) * 100 : 0,
            gameHistory: stats.gameHistory || [],
            zlatanPoints: stats.zlatanPoints || 0,
            ventielPoints: stats.ventielPoints || 0,
            actief: spelerRow ? (spelerRow[2]?.toLowerCase() === 'ja') : false
          } as Player;
        }).sort((a, b) => b.totalPoints - a.totalPoints);
      })
    );
  }
}
