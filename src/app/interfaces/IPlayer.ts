import { Positions } from '../enums/positions.enum';
import { PlayerStats } from './IGameStats';

export interface Player {
  name: string;
  position: string;
  rating: number;
  totalScore: number;
  stats?: PlayerStats;  // Optional since not all views need statistics
}
