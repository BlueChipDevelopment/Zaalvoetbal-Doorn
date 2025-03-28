export interface GameStats {
  date: string;
  points: number;
  playerIds: string[];  // IDs of other players in the same team
}

export interface PlayerStats {
  playerId: string;
  name: string;
  gamesPlayed: number;
  wins: number;
  totalPoints: number;
  gameHistory: GameStats[];
  chemistry: { [key: string]: { gamesPlayed: number; gamesWon: number } };
  zlatanPoints?: number;
  ventielPoints?: number;
  gamesWon?: number;
  gamesLost?: number;
  gamesTied?: number;
  winRatio?: number;
}