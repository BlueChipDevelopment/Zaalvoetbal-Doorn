import { Injectable } from '@angular/core';
import { Player } from '../interfaces/IPlayer';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { GoogleSheetsService } from './google-sheets-service';
import { PlayerService } from './player.service';

@Injectable({
  providedIn: 'root'
})
export class GameStatisticsService {
  private ratingsCache: Player[] | null = null;
  private cacheTimestamp: number | null = null;
  private cacheDurationMs = 5 * 60 * 1000; // 5 minuten

  constructor(
    private googleSheetsService: GoogleSheetsService,
    private playerService: PlayerService
  ) {}

  /**
   * Bepaalt het seizoen van een wedstrijd op basis van de datum.
   * Seizoen wisselt op 1 augustus.
   * @param dateString Datum string in DD-MM-YYYY of YYYY-MM-DD formaat
   * @returns Seizoen string in YYYY-YYYY formaat (bijv. "2024-2025") of null als de datum ongeldig is
   */
  private getSeasonFromDate(dateString: string): string | null {
    if (!dateString || dateString.trim() === '') {
      return null;
    }

    const parseDate = (d: string): Date => {
      const parts = d.split('-');
      if (parts.length === 3) {
        const part0 = parseInt(parts[0]);
        const part1 = parseInt(parts[1]);
        const part2 = parseInt(parts[2]);
        
        // Controleer of alle delen geldige nummers zijn
        if (isNaN(part0) || isNaN(part1) || isNaN(part2)) {
          return new Date('invalid');
        }

        if (parts[0].length === 4) {
          // YYYY-MM-DD
          return new Date(part0, part1 - 1, part2);
        } else {
          // DD-MM-YYYY
          return new Date(part2, part1 - 1, part0);
        }
      }
      return new Date('invalid');
    };

    const date = parseDate(dateString.trim());
    
    // Controleer of de datum geldig is
    if (isNaN(date.getTime())) {
      console.warn(`Ongeldige datum gevonden: ${dateString}`);
      return null;
    }

    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() is 0-based

    // Controleer of jaar een redelijke waarde is
    if (year < 2020 || year > 2030) {
      console.warn(`Onrealistisch jaar in datum: ${dateString} (jaar: ${year})`);
      return null;
    }

    // Als de datum op of na 1 augustus is, behoort het tot het seizoen dat in dat jaar start
    // Als de datum vóór 1 augustus is, behoort het tot het seizoen dat in het voorgaande jaar is gestart
    if (month >= 8) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  }

  /**
   * Haalt alle beschikbare seizoenen op uit de wedstrijdendata.
   * @returns Observable array van seizoen strings, gesorteerd van nieuw naar oud
   */
  getAvailableSeasons(): Observable<string[]> {
    return this.googleSheetsService.getSheetData('Wedstrijden').pipe(
      map(wedstrijden => {
        // Sla de header over (eerste rij) in wedstrijden
        const wedstrijdenData = (wedstrijden || []).slice(1);
        
        // Filter op wedstrijden met een geldige datum (ongeacht of ze al gespeeld zijn)
        const wedstrijdenMetDatum = wedstrijdenData.filter(match => {
          return match[1] && match[1].trim() !== ''; // Alleen wedstrijden met een datum
        });

        const seizoenen = new Set<string>();
        wedstrijdenMetDatum.forEach(match => {
          if (match[1]) { // datum kolom
            const seizoen = this.getSeasonFromDate(match[1]);
            if (seizoen) { // Alleen toevoegen als het seizoen geldig is
              seizoenen.add(seizoen);
            }
          }
        });

        return Array.from(seizoenen).sort((a, b) => {
          // Sorteer van nieuw naar oud (2024-2025 komt vóór 2023-2024)
          const yearA = parseInt(a.split('-')[0]);
          const yearB = parseInt(b.split('-')[0]);
          return yearB - yearA;
        });
      })
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
      wedstrijden: this.googleSheetsService.getSheetData('Wedstrijden')
    }).pipe(
      map(({ spelers, wedstrijden }) => {
        // spelers is already typed and processed by PlayerService
        const actieveSpelers = spelers.filter(player => player.actief);
        const actieveSpelersMap: { [naam: string]: any } = {};
        actieveSpelers.forEach((player) => {
          actieveSpelersMap[player.name.trim().toLowerCase()] = player;
        });

        let geldigeWedstrijden = (wedstrijden || []).filter(match => {
          const wit = match[4];
          const rood = match[5];
          const isValidMatch = wit != null && wit !== '' && rood != null && rood !== '';
          
          // Ook controleren of de datum geldig is
          if (isValidMatch && match[1]) {
            const seizoen = this.getSeasonFromDate(match[1]);
            return seizoen !== null; // Alleen wedstrijden met geldige datum
          }
          
          return isValidMatch && !match[1]; // Wedstrijden zonder datum (voor backward compatibility)
        });

        // Filter wedstrijden op seizoen indien opgegeven
        if (season) {
          geldigeWedstrijden = geldigeWedstrijden.filter(match => {
            if (match[1]) { // datum kolom
              const matchSeason = this.getSeasonFromDate(match[1]);
              return matchSeason === season;
            }
            return false;
          });
        }

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
        return Object.entries(playerStats).map(([player, stats]) => {
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
        }).sort((a, b) => b.totalPoints - a.totalPoints);
      })
    );
  }
}
