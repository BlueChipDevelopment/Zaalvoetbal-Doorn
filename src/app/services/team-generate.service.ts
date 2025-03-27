import { Injectable } from '@angular/core';
import { Player } from '../interfaces/IPlayer';
import { FormArray } from '@angular/forms';
import { Positions } from '../enums/positions.enum';
import { Team, Teams } from '../interfaces/ITeam';

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
    TeamA: { shirtcolor: 'white', squad: [], attack: 0, defense: 0, condition: 0, totalScore: 0 },
    TeamB: { shirtcolor: 'red', squad: [], attack: 0, defense: 0, condition: 0, totalScore: 0 },
  };

  constructor() { }

  public generate(playerForms: FormArray): Teams {
    this.players = [];
    this.teams = {
      TeamA: { name: 'Team WIT', shirtcolor: 'white', squad: [], attack: 0, defense: 0, condition: 0, totalScore: 0 },
      TeamB: { name: 'Team ROOD', shirtcolor: 'red', squad: [], attack: 0, defense: 0, condition: 0, totalScore: 0 },
    };


    for (let playerForm of playerForms.controls) {
      let player = this.calculatePlayerScoreByRating(playerForm.value as Player);
      this.players.push(player);
    }

    // Distribute goalies first.
    this.goalKeepers = this.getPlayersByPosition(Positions.GOAL_KEEPER);
    if (this.goalKeepers.length > 0)
      this.distributePlayersToTeams(this.goalKeepers);

    // Distribute fieldplayers
    this.fieldPlayers = this.getPlayersByPosition(Positions.MIDFIELDER);
    if (this.fieldPlayers.length > 0)
      this.distributePlayersToTeams(this.fieldPlayers);

    // Calculeer score
    const teamA: Player[] = this.teams['TeamA'].squad.map(name => this.players.find(player => player.name === name)!);
    const teamB: Player[] = this.teams['TeamB'].squad.map(name => this.players.find(player => player.name === name)!);
    this.teams['TeamA'].totalScore = this.getTeamRating(teamA);
    this.teams['TeamB'].totalScore = this.getTeamRating(teamB);

    return this.teams;
  }

  private calculatePlayerScoreByRating(player: Player): Player {
    player.totalScore = player.rating;
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

  private distributePlayersToTeams(players: Player[]): void {
    let teamA: Player[] = [];
    let teamB: Player[] = [];

    // Shuffle players array to ensure randomness
    players = this.shuffleArray(players);

    // Distribute players to teams
    players.forEach(player => {
      if (teamA.length < teamB.length) {
        teamA.push(player);
      } else if (teamB.length < teamA.length) {
        teamB.push(player);
      } else {
        if (this.getTeamRating(teamA) <= this.getTeamRating(teamB)) {
          teamA.push(player);
        } else {
          teamB.push(player);
        }
      }
    });

    // Add players to the teams
    teamA.forEach(player => {
      this.teams['TeamA'].squad.push(player.name);
    });
    teamB.forEach(player => {
      this.teams['TeamB'].squad.push(player.name);
    });
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
