export interface Player {
  name: string;
  position: string;
  rating: number;
  gamesPlayed: number;
  totalPoints: number;
  wins: number;
  losses: number;
  ties: number;
  winRatio: number;
  gameHistory: any[];
  zlatanPoints: number;
  ventielPoints: number;
  actief: boolean;
  pushSubscription?: string; // JSON-stringified push subscription
  pushPermission?: boolean; // true if user gave permission
}

