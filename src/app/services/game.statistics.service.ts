import { Injectable } from '@angular/core';
import { Player } from '../interfaces/IPlayer';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { GoogleSheetsService } from './google-sheets-service';
import { PlayerService } from './player.service';
import { WedstrijdenService } from './wedstrijden.service';

@Injectable({
  providedIn: 'root'
})
export class GameStatisticsService {
  private ratingsCache: Player[] | null = null;
  private cacheTimestamp: number | null = null;
  private cacheDurationMs = 5 * 60 * 1000; // 5 minuten

  constructor(
    private googleSheetsService: GoogleSheetsService,
    private playerService: PlayerService,
    private wedstrijdenService: WedstrijdenService
  ) {}



  /**
   * Haalt alle beschikbare seizoenen op uit de wedstrijdendata.
   * @returns Observable array van seizoen strings, gesorteerd van nieuw naar oud
   */
  getAvailableSeasons(): Observable<string[]> {
    return this.wedstrijdenService.getBeschikbareSeizoen().pipe(
      map(seizoenData => seizoenData.map(s => s.seizoen))
    );
  }

  /**
   * Haalt het meest recente seizoen op.
   */
  getCurrentSeason(): Observable<string | null> {
    return this.getAvailableSeasons().pipe(
      map(seasons => seasons.length > 0 ? seasons[0] : null)
    );
  }

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
   * @param season Optioneel seizoen filter (bijv. "2024-2025"). Als null, worden alle wedstrijden meegenomen.
   */
  getFullPlayerStats(season?: string | null): Observable<Player[]> {
    return forkJoin({
      spelers: this.playerService.getPlayers(),
      wedstrijden: this.wedstrijdenService.getGespeeldeWedstrijden()
    }).pipe(
      map(({ spelers, wedstrijden }) => {
        // spelers is already typed and processed by PlayerService
        const actieveSpelers = spelers.filter(player => player.actief);
        const actieveSpelersMap: { [naam: string]: any } = {};
        actieveSpelers.forEach((player) => {
          actieveSpelersMap[player.name.trim().toLowerCase()] = player;
        });

        let geldigeWedstrijden = wedstrijden;

        // Filter wedstrijden op seizoen indien opgegeven
        if (season) {
          geldigeWedstrijden = geldigeWedstrijden.filter(match => {
            // Gebruik het seizoen direct uit de wedstrijd data (kolom B uit spreadsheet)
            return match.seizoen === season;
          });
        }

        // Sorteer geldigeWedstrijden op datum (oud -> nieuw) zodat gameHistory altijd chronologisch is
        const geldigeWedstrijdenSorted = [...geldigeWedstrijden].sort((a, b) => {
          // Datum is nu een Date object, dus direct vergelijken
          if (!a.datum || !b.datum) return 0;
          return a.datum.getTime() - b.datum.getTime();
        });
        
        // Statistieken per speler
        const playerStats: { [player: string]: { gamesPlayed: number; totalPoints: number; wins: number; losses: number; ties: number; gameHistory: any[]; zlatanPoints: number; ventielPoints: number } } = {};
        geldigeWedstrijdenSorted.forEach(match => {
          const teamWhitePlayers = (match.teamWit || '').split(',').map((p: string) => p.trim().toLowerCase()).filter((p: string) => p && p !== 'team wit');
          const teamRedPlayers = (match.teamRood || '').split(',').map((p: string) => p.trim().toLowerCase()).filter((p: string) => p && p !== 'team rood');
          const allPlayers = [...teamWhitePlayers, ...teamRedPlayers];
          const teamWhiteGoals = match.scoreWit || 0;
          const teamRedGoals = match.scoreRood || 0;
          
          // White team players
          teamWhitePlayers.forEach((player: string) => {
            if (!playerStats[player]) playerStats[player] = { gamesPlayed: 0, totalPoints: 0, wins: 0, losses: 0, ties: 0, gameHistory: [], zlatanPoints: 0, ventielPoints: 0 };
            playerStats[player].gamesPlayed++;
            if (teamWhiteGoals > teamRedGoals) playerStats[player].wins++;
            else if (teamWhiteGoals < teamRedGoals) playerStats[player].losses++;
            else playerStats[player].ties++;
            playerStats[player].gameHistory.push({
              result: teamWhiteGoals > teamRedGoals ? 3 : teamWhiteGoals === teamRedGoals ? 2 : 1,
              date: match.datum,
              playerIds: allPlayers,
              teammates: teamWhitePlayers,
              opponents: teamRedPlayers
            });
            if (match.zlatan && match.zlatan.trim().toLowerCase() === player) {
              playerStats[player].zlatanPoints = (playerStats[player].zlatanPoints || 0) + 1;
            }
            if (match.ventiel && match.ventiel.trim().toLowerCase() === player) {
              playerStats[player].ventielPoints = (playerStats[player].ventielPoints || 0) + 1;
            }
          });
          
          // Red team players
          teamRedPlayers.forEach((player: string) => {
            if (!playerStats[player]) playerStats[player] = { gamesPlayed: 0, totalPoints: 0, wins: 0, losses: 0, ties: 0, gameHistory: [], zlatanPoints: 0, ventielPoints: 0 };
            playerStats[player].gamesPlayed++;
            if (teamRedGoals > teamWhiteGoals) playerStats[player].wins++;
            else if (teamRedGoals < teamWhiteGoals) playerStats[player].losses++;
            else playerStats[player].ties++;
            playerStats[player].gameHistory.push({
              result: teamRedGoals > teamWhiteGoals ? 3 : teamRedGoals === teamWhiteGoals ? 2 : 1,
              date: match.datum,
              playerIds: allPlayers,
              teammates: teamRedPlayers,
              opponents: teamWhitePlayers
            });
            if (match.zlatan && match.zlatan.trim().toLowerCase() === player) {
              playerStats[player].zlatanPoints = (playerStats[player].zlatanPoints || 0) + 1;
            }
            if (match.ventiel && match.ventiel.trim().toLowerCase() === player) {
              playerStats[player].ventielPoints = (playerStats[player].ventielPoints || 0) + 1;
            }
          });
        });
        // Voeg spelers toe die in de Spelers-lijst staan maar nog geen wedstrijden hebben gespeeld
        spelers.forEach((player) => {
          const naam = player.name?.trim().toLowerCase();
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
        return Object.entries(playerStats)
          .map(([player, stats]) => {
            // Zoek de speler op in de PlayerService data
            const spelerData = spelers.find((p) => p.name && p.name.trim().toLowerCase() === player);
            let rating = Math.round((stats.totalPoints / (maxTotalPoints / 10)));
            rating = Math.max(1, Math.min(10, rating));
            return {
              name: spelerData ? spelerData.name : player,
              position: spelerData ? spelerData.position : null,
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
              actief: spelerData ? spelerData.actief : false
            } as Player;
          })
          // Filter: verwijder spelers die niet actief zijn EN geen wedstrijden hebben in dit seizoen
          .filter(player => player.actief || player.gamesPlayed > 0)
          .sort((a, b) => b.totalPoints - a.totalPoints);
      })
    );
  }
}
