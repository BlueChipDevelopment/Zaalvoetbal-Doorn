import { Injectable } from '@angular/core';
import { Player } from '../interfaces/IPlayer';
import { Positions } from '../enums/positions.enum';
import { Team } from '../interfaces/ITeam';
import { GoogleSheetsService } from './google-sheets-service';
import { GameStatisticsService } from './game.statistics.service';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { parseDate } from '../utils/date-utils';

@Injectable({
  providedIn: 'root'
})
export class TeamGenerateService {
  private generatedTeams: Team[] = [];

  constructor(private googleSheetsService: GoogleSheetsService, private gameStatisticsService: GameStatisticsService) {}

  generateTeams(players: Player[]): void {
    if (!players || players.length === 0) {
      return;
    }
    // Direct teamgeneratie
    this.completeTeamGeneration(players);
  }

  private completeTeamGeneration(players: Player[]): void {
    // Sort players by position for efficient team distribution
    const goalKeepers = players.filter(player => player.position === Positions.GOAL_KEEPER);
    const fieldPlayers = players.filter(player => player.position !== Positions.GOAL_KEEPER);

    // Create teams with optimized distribution
    const [teamWhite, teamRed] = this.createTeams(
      goalKeepers,
      fieldPlayers,
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

  getFullPlayerStats(season?: string | null): Observable<any[]> {
    return this.gameStatisticsService.getFullPlayerStats(season);
  }

  getCurrentSeasonPlayerStats(): Observable<any[]> {
    return this.gameStatisticsService.getCurrentSeason().pipe(
      switchMap(currentSeason => {
        return this.gameStatisticsService.getFullPlayerStats(currentSeason);
      })
    );
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
  private createTeams(
    goalKeepers: Player[],
    players: Player[],
  ): [Team, Team] {
    const teamWhite: Team = {
      name: 'Team Wit',
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
      name: 'Team Rood',
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
    this.distributePlayersByPosition(players, teamWhite, teamRed);

    // Calculate final scores including form factor
    teamWhite.sumOfRatings = teamWhite.squad.reduce((sum, player) => sum + (player.rating || 0), 0);
    teamWhite.chemistryScore = this.calculateTeamChemistry(teamWhite.squad.map(player => player.name));
    // Total score now includes form-adjusted ratings
    teamWhite.totalScore = this.calculateTeamScore(teamWhite.squad.map(player => player.name));

    teamRed.sumOfRatings = teamRed.squad.reduce((sum, player) => sum + (player.rating || 0), 0);
    teamRed.chemistryScore = this.calculateTeamChemistry(teamRed.squad.map(player => player.name));
    // Total score now includes form-adjusted ratings
    teamRed.totalScore = this.calculateTeamScore(teamRed.squad.map(player => player.name));

    return [teamWhite, teamRed];
  }

  private getPlayerByName(name: string): Player | null {
    return this.getPlayerStatsFromCache(name);
  }

  // Helper to distribute players efficiently
  private distributePlayersByPosition(players: Player[], teamWhite: Team, teamRed: Team): void {
    // Shuffle within position for randomness
    const shuffledPlayers = this.shuffle([...players]);

    for (const player of shuffledPlayers) {
      // Ensure even distribution of players between teams
      if (teamWhite.squad.length < teamRed.squad.length) {
        teamWhite.squad.push(player);
      } else if (teamRed.squad.length < teamWhite.squad.length) {
        teamRed.squad.push(player);
      } else {
        // If both teams have equal players, add to the team with lower score
        const whiteScore = this.calculateTeamScore(teamWhite.squad.map(p => p.name));
        const redScore = this.calculateTeamScore(teamRed.squad.map(p => p.name));

        if (whiteScore <= redScore) {
          teamWhite.squad.push(player);
        } else {
          teamRed.squad.push(player);
        }
      }
    }
  }

  // Calculate player's recent form based on last 5 games (0.5 to 1.5 multiplier)
  private calculateRecentForm(player: Player): number {
    if (!player.gameHistory || player.gameHistory.length === 0) {
      return 1.0; // Neutral form for players without history
    }
    
    // Get last 5 games, sorted by date (most recent first)
    const recentGames = player.gameHistory
      .sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        if (!dateA || !dateB) return 0;
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 5);
    
    if (recentGames.length === 0) return 1.0;
    
    // Calculate form based on results (3=win, 2=tie, 1=loss)
    const recentPoints = recentGames.reduce((sum, game) => sum + game.result, 0);
    const maxPossible = recentGames.length * 3;
    const formRatio = recentPoints / maxPossible;
    
    // Convert to multiplier between 0.5 (very poor form) and 1.5 (excellent form)
    // 0.0 ratio = 0.5 multiplier, 0.5 ratio = 1.0 multiplier, 1.0 ratio = 1.5 multiplier
    return 0.5 + (formRatio * 1.0);
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
  
  private getPlayerStatsFromCache(playerName: string): Player | null {
    return this.gameStatisticsService.getPlayerStatsByName(playerName) || null;
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
        } else if (player.position === Positions.PLAYER.toString()) {
          positionBonus += 0.5;  // Midfielders add good chemistry
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

    let totalScore = 0;
    for (const name of playerNames) {
      const player = this.getPlayerByName(name);
      if (player && player.rating) {
        // Apply form factor to the player's rating
        const formMultiplier = this.calculateRecentForm(player);
        const adjustedRating = player.rating * formMultiplier;
        totalScore += adjustedRating;
      }
    }

    return totalScore;
  }
}
