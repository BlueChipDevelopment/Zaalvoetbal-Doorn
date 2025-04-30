import { Injectable } from '@angular/core';
import { Player } from '../interfaces/IPlayer';
import { Positions } from '../enums/positions.enum';
import { Team } from '../interfaces/ITeam';
import { GoogleSheetsService } from './google-sheets-service';
import { GameStatisticsService } from './game.statistics.service';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';

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
    const [teamWhite, teamRed] = this.createTeamsV2(
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

  getFullPlayerStats(): Observable<any[]> {
    return this.gameStatisticsService.getFullPlayerStats();
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
    players: Player[],
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
    this.distributePlayersByPosition(players, teamWhite, teamRed);

    // Calculate final scores as the sum of individual player ratings
    teamWhite.sumOfRatings = teamWhite.squad.reduce((sum, player) => sum + (player.rating || 0), 0);
    teamWhite.chemistryScore = this.calculateTeamChemistry(teamWhite.squad.map(player => player.name));
    teamWhite.totalScore = teamWhite.sumOfRatings;

    teamRed.sumOfRatings = teamRed.squad.reduce((sum, player) => sum + (player.rating || 0), 0);
    teamRed.chemistryScore = this.calculateTeamChemistry(teamRed.squad.map(player => player.name));
    teamRed.totalScore = teamRed.sumOfRatings;

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

    let sumOfRatings = 0;
    for (const name of playerNames) {
      const player = this.getPlayerByName(name);
      if (player && player.rating) {
        sumOfRatings += player.rating;
      }
    }

    return sumOfRatings;
  }
}
