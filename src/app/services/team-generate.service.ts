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
  private midfielders: Player[] = [] as Player[];
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
      this.distributePlayersToTeamsByCoPilot(this.goalKeepers);

    // if (this.defenders.length > 0)
    //   this.distributePlayersToTeamsByCoPilot(this.defenders);

    this.midfielders = this.getPlayersByPosition(Positions.MIDFIELDER);
    if (this.midfielders.length > 0)
      this.distributePlayersToTeamsByCoPilot(this.midfielders);

    // if (this.strikers.length > 0)
    //   this.distributePlayersToTeamsByCoPilot(this.strikers);

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

  // private calculatePlayerScore(player: Player): Player {
  //   switch (player.position) {
  //     case Positions.GOAL_KEEPER:
  //       player.totalScore = player.rating;
  //       break;
  //     case Positions.DEFENDER:
  //       player.totalScore =
  //         player.defenceRating * 1 +
  //         player.conditionRating * 0.7 +
  //         player.attackRating * 0.5;
  //       break;
  //     case Positions.STRIKER:
  //       player.totalScore =
  //         player.defenceRating * 0.3 +
  //         player.conditionRating * 0.6 +
  //         player.attackRating * 1;
  //       break;
  //     case Positions.MIDFIELDER:
  //       player.totalScore =
  //         player.defenceRating * 0.6 +
  //         player.conditionRating * 0.9 +
  //         player.attackRating * 0.6;
  //       break;
  //   }
  //   return player;
  // }

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
          this.midfielders.push(player);
          break;
        case Positions.STRIKER:
          this.strikers.push(player);
          break;
      }
    });
  }

  private distributePlayersToTeamsByCoPilot(players: Player[]): void {
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

  // private distributePlayersToTeams(players: Player[]): void {
  //   let team = ['TeamA' as keyof Teams, 'TeamB' as keyof Teams];
  //   let chosenTeam = team[this.randomInt(0, 1)];
  //   let oppositeTeam = this.switchTeam(chosenTeam);

  //   if (
  //     this.teams[chosenTeam].squad.length >=
  //     this.teams[oppositeTeam].squad.length
  //   )
  //     chosenTeam = oppositeTeam;

  //   let randomPlayerIndex = this.randomInt(0, players.length - 1);
  //   players = this.addPlayerToTeam(chosenTeam, randomPlayerIndex, players);

  //   let playersNotMutated = [...players];
  //   for (let i = 0; i < playersNotMutated.length; i++) {
  //     let counterPlayerIndex = this.getCounterPlayerIndex(chosenTeam, players);
  //     chosenTeam = this.switchTeam(chosenTeam);
  //     this.addPlayerToTeam(chosenTeam, counterPlayerIndex, players);
  //   }
  // }

  // private randomInt(min: number, max: number): number {
  //   //? min and max included
  //   return Math.floor(Math.random() * (max - min + 1) + min);
  // }

  // private addPlayerToTeam(
  //   team: keyof Teams,
  //   playerIndex: number,
  //   players: Player[]
  // ): Player[] {
  //   this.teams[team].squad.push(players[playerIndex].name);
  //   this.teams[team].totalScore += players[playerIndex].totalScore;
  //   players.splice(playerIndex, 1);
  //   return players;
  // }

  // private switchTeam(team: keyof Teams): keyof Teams {
  //   return team === 'TeamA'
  //     ? ('TeamB' as keyof Teams)
  //     : ('TeamA' as keyof Teams);
  // }

  // private getCounterPlayerIndex(team: keyof Teams, players: Player[]): number {
  //   let currentTeamScore = this.teams[team].totalScore;
  //   let counterTeamScore = this.teams[this.switchTeam(team)].totalScore;

  //   if (counterTeamScore >= currentTeamScore)
  //     return this.pickWorstPlayer(players);

  //   let counterPlayerIndex = players.findIndex((player) => {
  //     return currentTeamScore <= counterTeamScore + player.totalScore;
  //   });

  //   if (counterPlayerIndex == -1)
  //     return this.pickBestPlayer(players);

  //   return counterPlayerIndex;
  // }

  // private pickWorstPlayer(players: Player[]): number {
  //   let worstScore = 0;
  //   let worstPlayerIndex = 0;

  //   players.forEach((player, index) => {
  //     if (worstScore >= player.totalScore) {
  //       worstScore = player.totalScore;
  //       worstPlayerIndex = index;
  //     }
  //   });

  //   return worstPlayerIndex;
  // }

  // private pickBestPlayer(players: Player[]): number {
  //   let bestScore = 0;
  //   let bestPlayerIndex = 0;

  //   players.forEach((player, index) => {
  //     if (bestScore <= player.totalScore) {
  //       bestScore = player.totalScore;
  //       bestPlayerIndex = index;
  //     }
  //   });

  //   return bestPlayerIndex;
  // }
}
