import { Player } from './IPlayer';

export interface Team {
  name: string;
  squad: Player[];
  totalScore: number;
  shirtcolor: string;
  attack: number;
  defense: number;
  condition: number;
  sumOfRatings: number; // Sum of player ratings
  chemistryScore: number;  // Chemistry bonus score
}

export interface Teams {
  teamWhite: Team;
  teamRed: Team;
}
