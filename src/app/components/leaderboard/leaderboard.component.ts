import { MatDialog } from '@angular/material/dialog';
import { Component, OnInit, HostListener } from '@angular/core';
import { LeaderboardService } from '../../services/leaderboard.service';
import { PlayerStats } from '../../interfaces/IGameStats';
import { Observable } from 'rxjs';
import { ChemistryModalComponent } from './chemistry-modal.component';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.css']
})
export class LeaderboardComponent implements OnInit {
  leaderboard: PlayerStats[] = [];
  selectedPlayer: PlayerStats | null = null;
  bestTeammates: { playerId: string; name: string; chemistry: number; gamesPlayed: number; gamesWon: number }[] = [];
  displayedColumns: string[] = ['position', 'name', 'gamesPlayed', 'totalPoints', 'gamesWon', 'gamesLost', 'gamesTied', 'zlatanPoints', 'ventielPoints', 'winRatio'];
  mobileDisplayedColumns: string[] = ['position', 'name', 'gamesPlayed', 'totalPoints'];
  isMobile = false;
  
  constructor(private leaderboardService: LeaderboardService, private dialog: MatDialog) {
    this.checkScreenSize();
  }

  ngOnInit(): void {
    this.loadLeaderboard();
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize(): void {
    this.isMobile = window.innerWidth < 768;
  }

  get currentDisplayColumns(): string[] {
    return this.isMobile ? this.mobileDisplayedColumns : this.displayedColumns;
  }

  private loadLeaderboard(): void {
    this.leaderboardService.getLeaderboard().subscribe(players => {
      this.leaderboard = players.map(player => {
        const gamesWon = player.gameHistory.filter(game => game.points === 3).length;
        const gamesLost = player.gameHistory.filter(game => game.points === 1).length;
        const gamesTied = player.gameHistory.filter(game => game.points === 2).length;

        return {
          ...player,
          zlatanPoints: player.zlatanPoints || 0,
          ventielPoints: player.ventielPoints || 0,
          winRatio: player.gamesPlayed > 0 ? (gamesWon / player.gamesPlayed) * 100 : 0,
          gamesWon: gamesWon,
          gamesLost: gamesLost,
          gamesTied: gamesTied
        };
      });
    });
  }

  protected getPlayerPosition(player: PlayerStats): number {
    return this.leaderboard.indexOf(player) + 1;
  }

  protected selectPlayer(player: PlayerStats): void {
    this.selectedPlayer = player;
    if (player) {
      this.leaderboardService.getBestTeammates(player.playerId).subscribe(teammates => {
        // Map player IDs to names using the leaderboard data and filter out 'Unknown' entries
        this.bestTeammates = teammates
          .map(teammate => ({
            ...teammate,
            name: this.leaderboard.find(p => p.playerId === teammate.playerId)?.name || 'Unknown'
          }))
          .filter(teammate => teammate.name !== 'Unknown');
      });
    }
  }

  protected openChemistryModal(player: PlayerStats): void {
    this.dialog.open(ChemistryModalComponent, {
      width: '400px',
      data: {
        player: player,
        bestTeammates: this.getBestAndWorstTeammates(player)
      }
    });
  }

  private getBestAndWorstTeammates(player: PlayerStats): { best: any; worst: any } {
    const teammates = Object.entries(player.chemistry).map(([id, stats]) => {
      const teammate = this.leaderboard.find(p => p.playerId === id);
      
      if (!teammate) return null;

      // Find all games played together
      const gamesPlayedTogether = player.gameHistory.filter(game => 
        game.playerIds.includes(id)
      );

      // Calculate tied and lost games
      const gamesWon = gamesPlayedTogether.filter(game => game.points === 3).length;
      const gamesTied = gamesPlayedTogether.filter(game => game.points === 2).length;
      const gamesLost = gamesPlayedTogether.filter(game => game.points === 1).length;

      return {
        playerId: id,
        name: teammate.name,
        gamesPlayed: stats.gamesPlayed,
        gamesWon: gamesWon,
        gamesTied: gamesTied,
        gamesLost: gamesLost,
        chemistryScore: stats.gamesPlayed > 0 ? stats.gamesWon / stats.gamesPlayed : 0
      };
    }).filter(t => t !== null);

    const sortedTeammates = teammates.filter(t => t.gamesPlayed > 0).sort((a, b) => b.chemistryScore - a.chemistryScore);

    return {
      best: sortedTeammates.length > 0 ? sortedTeammates[0] : { name: 'No data', gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesTied: 0, chemistryScore: 0 },
      worst: sortedTeammates.length > 0 ? sortedTeammates[sortedTeammates.length - 1] : { name: 'No data', gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesTied: 0, chemistryScore: 0 }
    };
  }
}