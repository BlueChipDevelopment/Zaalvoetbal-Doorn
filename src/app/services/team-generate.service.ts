import { Injectable } from '@angular/core';
import { Player } from '../interfaces/IPlayer';
import { FormArray } from '@angular/forms';
import { Positions } from '../enums/positions.enum';
import { Team, Teams } from '../interfaces/ITeam';
import { LeaderboardService } from './leaderboard.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TeamGenerateService {
  private players: Player[] = [];
  private goalKeepers: Player[] = [] as Player[];
  private defenders: Player[] = [] as Player[];
  private fieldPlayers: Player[] = [] as Player[];
  private strikers: Player[] = [] as Player[];
  private teams: Teams = {
    TeamA: { name: 'Team White', shirtcolor: 'white', squad: [], attack: 0, defense: 0, condition: 0, totalScore: 0 },
    TeamB: { name: 'Team Red', shirtcolor: 'red', squad: [], attack: 0, defense: 0, condition: 0, totalScore: 0 },
  };

  constructor(private leaderboardService: LeaderboardService) {}

  public async generate(playerForms: FormArray): Promise<Teams> {
    // Reset all arrays
    this.players = [];
    this.goalKeepers = [];
    this.defenders = [];
    this.fieldPlayers = [];
    this.strikers = [];
    
    // Get player statistics for chemistry calculations
    const playerStats = await firstValueFrom(this.leaderboardService.getLeaderboard());

    // Convert form data to players and calculate total scores
    playerForms.controls.forEach((playerForm: any) => {
      const player: Player = {
        name: playerForm.value.name,
        position: playerForm.value.position,
        rating: playerForm.value.rating,
        totalScore: 0,
        stats: playerStats.find(ps => ps.name === playerForm.value.name)
      };
      this.players.push(this.calculatePlayerScoreByRating(player));
    });

    // Sort players by position
    this.sortByPositions(this.players);

    // Reset teams
    this.teams.TeamA.squad = [];
    this.teams.TeamB.squad = [];
    this.teams.TeamA.totalScore = 0;
    this.teams.TeamB.totalScore = 0;

    // Distribute players considering chemistry
    this.distributeGoalKeepers();
    this.distributeDefenders();
    this.distributeFieldPlayers();
    this.distributeStrikers();

    return this.teams;
  }

  private calculatePlayerScoreByRating(player: Player): Player {
    // Base score from rating
    player.totalScore = player.rating;
    
    // Add chemistry bonus if available
    if (player.stats) {
      // Add average points per game as a small bonus (10% weight)
      const avgPoints = player.stats.totalPoints / player.stats.gamesPlayed;
      player.totalScore += (avgPoints * 0.1);
    }
    
    return player;
  }
 
  private getPlayersByPosition(position: Positions): Player[] {
    return this.players.filter(player => player.position === position);
  }

  private sortByPositions(players: Player[]): void {
    players.forEach((player) => {
      switch (player.position) {
        case Positions.GOAL_KEEPER:
          this.goalKeepers.push(player);
          break;
        case Positions.DEFENDER:
          this.defenders.push(player);
          break;
        case Positions.MIDFIELDER:
          this.fieldPlayers.push(player);
          break;
        case Positions.STRIKER:
          this.strikers.push(player);
          break;
      }
    });
  }

  private distributeGoalKeepers(): void {
    if (this.goalKeepers.length > 0) {
      this.goalKeepers = this.shuffleArray(this.goalKeepers);
      this.teams.TeamA.squad.push(this.goalKeepers[0].name);
      this.teams.TeamA.totalScore += this.goalKeepers[0].totalScore;

      if (this.goalKeepers.length > 1) {
        this.teams.TeamB.squad.push(this.goalKeepers[1].name);
        this.teams.TeamB.totalScore += this.goalKeepers[1].totalScore;
      }
    }
  }

  private distributeDefenders(): void {
    if (this.defenders.length > 0) {
      this.defenders = this.shuffleArray(this.defenders);
      this.distributePlayersByChemistry(this.defenders);
    }
  }

  private distributeFieldPlayers(): void {
    if (this.fieldPlayers.length > 0) {
      this.fieldPlayers = this.shuffleArray(this.fieldPlayers);
      this.distributePlayersByChemistry(this.fieldPlayers);
    }
  }

  private distributeStrikers(): void {
    if (this.strikers.length > 0) {
      this.strikers = this.shuffleArray(this.strikers);
      this.distributePlayersByChemistry(this.strikers);
    }
  }

  private distributePlayersByChemistry(players: Player[]): void {
    for (const player of players) {
      // Calculate potential chemistry for both teams
      const teamAChemistry = this.calculateTeamChemistry(player, this.teams.TeamA.squad);
      const teamBChemistry = this.calculateTeamChemistry(player, this.teams.TeamB.squad);
      
      // Adjust scores based on team size to keep teams balanced
      const teamAScore = this.teams.TeamA.totalScore + player.totalScore + (teamAChemistry * 0.2);
      const teamBScore = this.teams.TeamB.totalScore + player.totalScore + (teamBChemistry * 0.2);
      
      // Assign to team with lower adjusted score
      if (teamAScore <= teamBScore) {
        this.teams.TeamA.squad.push(player.name);
        this.teams.TeamA.totalScore += player.totalScore;
      } else {
        this.teams.TeamB.squad.push(player.name);
        this.teams.TeamB.totalScore += player.totalScore;
      }
    }
  }

  private calculateTeamChemistry(player: Player, teamSquad: string[]): number {
    if (!player.stats) return 0;

    let totalChemistry = 0;
    for (const teammate of teamSquad) {
      const teammateStats = player.stats.chemistry[teammate];
      if (teammateStats) {
        const chemistryScore = teammateStats.gamesPlayed > 0 ? teammateStats.gamesWon / teammateStats.gamesPlayed : 0;
        totalChemistry += chemistryScore;
      }
    }

    return teamSquad.length > 0 ? totalChemistry / teamSquad.length : 0;
  }

  private shuffleArray(array: any[]): any[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  private getTeamRating(team: Player[]): number {
    return team.reduce((total, player) => total + player.rating, 0);
  }
}
