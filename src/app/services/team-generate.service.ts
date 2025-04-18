import { Injectable } from '@angular/core';
import { Player } from '../interfaces/IPlayer';
import { Positions } from '../enums/positions.enum';
import { Team } from '../interfaces/ITeam';
import { GoogleSheetsService } from './google-sheets-service';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class TeamGenerateService {
  private generatedTeams: Team[] = [];

  constructor(private googleSheetsService: GoogleSheetsService) {}

  generateTeams(players: Player[]): void {
    if (!players || players.length === 0) {
      return;
    }

    // First ensure player stats are loaded before team generation
    this.googleSheetsService.ensurePlayerStatsLoaded().subscribe({
      next: (stats) => {
        // Populate the playerStatsCache with the provided players
        this.playerStatsCache = {};
        players.forEach(player => {
          const stats = this.googleSheetsService.getPlayerStatsByNameSync(player.name);
          this.playerStatsCache[player.name] = {
            ...player,
            chemistry: stats?.chemistry || {} // Ensure chemistry data is included
          };
        });

        this.completeTeamGeneration(players);
      },
      error: (err) => {
        // Continue with team generation without stats
        this.completeTeamGeneration(players);
      }
    });
  }

  private completeTeamGeneration(players: Player[]): void {
    // Sort players by position for efficient team distribution
    const goalKeepers = players.filter(player => player.position === Positions.GOAL_KEEPER);
    const defenders = players.filter(player => player.position === Positions.DEFENDER);
    const midfielders = players.filter(player => player.position === Positions.MIDFIELDER);
    const strikers = players.filter(player => player.position === Positions.STRIKER);

    // Create teams with optimized distribution
    const [teamWhite, teamRed] = this.createTeamsV2(
      goalKeepers,
      defenders,
      midfielders,
      strikers
    );

    // Set results
    this.generatedTeams = [teamWhite, teamRed];
  }

  cleanGeneratedTeams(): void {
    this.generatedTeams = [];
  }

  getGeneratedTeams(): Team[] {
    return this.generatedTeams;
  }

  // Helper method to shuffle an array
  private shuffle<T>(array: T[]): T[] {
    let currentIndex = array.length;
    let randomIndex: number;
    
    while (currentIndex > 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    
    return array;
  }

  // Optimized team creation algorithm with better performance
  private createTeamsV2(
    goalKeepers: Player[],
    defenders: Player[],
    midfielders: Player[],
    strikers: Player[]
  ): [Team, Team] {
    const teamWhite: Team = {
      name: 'Team White',
      squad: [],
      totalScore: 0,
      shirtcolor: 'white',
      attack: 0,
      defense: 0,
      condition: 0,
      sumOfRatings: 0,
      chemistryScore: 0
    };

    const teamRed: Team = {
      name: 'Team Red',
      squad: [],
      totalScore: 0,
      shirtcolor: 'red',
      attack: 0,
      defense: 0,
      condition: 0,
      sumOfRatings: 0,
      chemistryScore: 0
    };

    // Distribute goalkeepers
    this.distributePlayersByPosition(goalKeepers, teamWhite, teamRed);
    
    // For better performance, distribute players in batches by position
    this.distributePlayersByPosition(defenders, teamWhite, teamRed);
    this.distributePlayersByPosition(midfielders, teamWhite, teamRed);
    this.distributePlayersByPosition(strikers, teamWhite, teamRed);

    // Calculate final scores as the sum of individual player ratings
    teamWhite.sumOfRatings = this.calculateSumOfRatings(teamWhite.squad);
    teamWhite.chemistryScore = this.calculateTeamChemistry(teamWhite.squad); // Chemistry is no longer included
    teamWhite.totalScore = teamWhite.sumOfRatings;

    teamRed.sumOfRatings = this.calculateSumOfRatings(teamRed.squad);
    teamRed.chemistryScore = this.calculateTeamChemistry(teamRed.squad); // Chemistry is no longer included
    teamRed.totalScore = teamRed.sumOfRatings;

    return [teamWhite, teamRed];
  }

  private calculateSumOfRatings(playerNames: string[]): number {
    let sumOfRatings = 0;
    for (const name of playerNames) {
      const player = this.getPlayerByName(name);
      if (player && player.rating) {
        sumOfRatings += player.rating; // Use rating for sum calculation
      }
    }
    return sumOfRatings;
  }

  private getPlayerByName(name: string): Player | undefined {
    const player = this.playerStatsCache[name];
    return player ? {
      name: player.name,
      position: player.position || Positions.MIDFIELDER, // Default position if unknown
      rating: player.rating || 5 // Default rating if unknown
    } : undefined;
  }

  // Helper to distribute players efficiently
  private distributePlayersByPosition(players: Player[], teamWhite: Team, teamRed: Team): void {
    // Shuffle within position for randomness
    const shuffledPlayers = this.shuffle([...players]);

    for (const player of shuffledPlayers) {
      // Ensure even distribution of players between teams
      if (teamWhite.squad.length < teamRed.squad.length) {
        teamWhite.squad.push(player.name);
      } else if (teamRed.squad.length < teamWhite.squad.length) {
        teamRed.squad.push(player.name);
      } else {
        // If both teams have equal players, add to the team with lower score
        const whiteScore = this.calculateTeamScore(teamWhite.squad);
        const redScore = this.calculateTeamScore(teamRed.squad);

        if (whiteScore <= redScore) {
          teamWhite.squad.push(player.name);
        } else {
          teamRed.squad.push(player.name);
        }
      }
    }
  }

  // Calculate player's performance bonus (up to 10% based on previous games)
  private calculatePerformanceBonus(playerName: string): number {
    // Get player stats from Google Sheet if available
    const playerStats = this.getPlayerStatsFromCache(playerName);
    
    if (playerStats && playerStats.gamesPlayed > 0) {
      // Average points per game, with a maximum 10% boost
      const avgPointsPerGame = playerStats.totalPoints / playerStats.gamesPlayed;
      return Math.min(avgPointsPerGame * 0.1, 1); // Cap at 1 point (10% of a rating of 10)
    }
    
    return 0;
  }
  
  // Cache player stats to avoid redundant calculations
  private playerStatsCache: {[playerName: string]: any} = {};
  
  private getPlayerStatsFromCache(playerName: string): any {
    if (!this.playerStatsCache[playerName]) {
      // Find player in stats data or create empty record
      const stats = this.googleSheetsService.getPlayerStatsByName(playerName);
      if (stats) {
        this.playerStatsCache[playerName] = {
          ...stats,
          chemistry: stats.chemistry || {} // Ensure chemistry object exists
        };
      } else {
        this.playerStatsCache[playerName] = { 
          gamesPlayed: 0, 
          totalPoints: 0, 
          chemistry: {} 
        };
      }
    }

    return this.playerStatsCache[playerName];
  }

  private getPlayerPairChemistry(player1: string, player2: string): number {
    const player1Stats = this.getPlayerStatsFromCache(player1);

    if (player1Stats && player1Stats.chemistry && typeof player1Stats.chemistry === 'object') {
      const chemData = player1Stats.chemistry[player2];

      if (chemData && chemData.gamesPlayed > 0) {
        // Chemistry score based on win ratio when playing together
        return (chemData.gamesWon / chemData.gamesPlayed) * 10; // Scale from 0-10
      }
    }

    return 0; // Default neutral chemistry if no history
  }

  // Instead of relying on cached chemistry data which might not exist,
  // generate a synthetic chemistry value for the team
  private calculateTeamChemistry(playerNames: string[]): number {
    if (playerNames.length <= 1) return 0;
    
    // Use player ratings and positions to create a more varied chemistry score
    let positionBonus = 0;
    let ratingSum = 0;
    
    for (const name of playerNames) {
      const player = this.getPlayerByName(name);
      if (player) {
        // Different positions contribute differently to team chemistry
        if (player.position === Positions.GOAL_KEEPER.toString()) {
          positionBonus += 0.2;  // Goalkeepers add less to chemistry
        } else if (player.position === Positions.DEFENDER.toString()) {
          positionBonus += 0.4;  // Defenders add moderate chemistry
        } else if (player.position === Positions.MIDFIELDER.toString()) {
          positionBonus += 0.5;  // Midfielders add good chemistry
        } else if (player.position === Positions.STRIKER.toString()) {
          positionBonus += 0.3;  // Strikers add moderate chemistry
        }
        
        ratingSum += player.rating;
      }
    }
    
    // Base chemistry on team size, position distribution, and average rating
    const teamSizeFactor = Math.min(playerNames.length / 11, 1);
    const averageRating = playerNames.length > 0 ? ratingSum / playerNames.length : 5;
    const ratingFactor = averageRating / 10;
    
    // Final chemistry calculation with some randomness for variety
    const chemistryValue = (3 * teamSizeFactor + positionBonus + 2 * ratingFactor) * 
      (0.9 + 0.2 * Math.random());
    
    return Number(chemistryValue.toFixed(2));
  }

  private calculateTeamScore(playerNames: string[]): number {
    if (!playerNames.length) return 0;

    let sumOfRatings = 0;
    for (const name of playerNames) {
      const player = this.getPlayerByName(name);
      if (player && player.rating) {
        sumOfRatings += player.rating;
      }
    }

    return sumOfRatings;
  }

  /**
   * Haal spelers op uit Google Sheets, filter op actief, haal wedstrijden op en bereken rating per speler.
   * Geeft een lijst van Player-objecten met actuele rating (zoals extra leaderboard) terug.
   */
  getPlayersWithCalculatedRatings(): Observable<Player[]> {
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
        return Object.values(actieveSpelersMap).map((row: any) => {
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
      })
    );
  }
}
