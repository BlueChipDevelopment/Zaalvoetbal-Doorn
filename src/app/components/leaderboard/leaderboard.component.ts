import { Component, OnInit, HostListener } from '@angular/core';
import { GameStatisticsService } from '../../services/game.statistics.service';
import { TitleCasePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { ChemistryModalComponent } from './chemistry-modal.component';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss']
})
export class LeaderboardComponent implements OnInit {
  leaderboard: any[] = [];
  isMobile = false;
  isLoading = true; 

  constructor(
    private titleCasePipe: TitleCasePipe,
    private gameStatisticsService: GameStatisticsService,
    private dialog: MatDialog
  ) {}

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  ngOnInit(): void {
    this.checkScreenSize();
    this.loadLeaderboard();
  }

  private checkScreenSize(): void {
    this.isMobile = window.innerWidth < 768;
  }

  private loadLeaderboard(): void {
    this.isLoading = true;
    this.gameStatisticsService.getFullPlayerStats().subscribe({
      next: (leaderboard: any[]) => {
        this.leaderboard = leaderboard;
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading leaderboard:', error);
        this.isLoading = false;
      }
    });
  }

  protected getLastFiveGames(player: any): { result: number; date: string; dateDisplay: string }[] {
    if (!player.gameHistory || player.gameHistory.length === 0) {
      return [];
    }
    return [...player.gameHistory]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-5)
      .map(game => {
        let dateDisplay = game.date;
        if (game.date) {
          const dateParts = game.date.split('-');
          if (dateParts.length === 3) {
            if (dateParts[0].length === 4) {
              // YYYY-MM-DD → DD-MM-YYYY
              dateDisplay = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
            } else {
              // DD-MM-YYYY of andere volgorde, laat staan
              dateDisplay = game.date;
            }
          }
        }
        return {
          result: game.result,
          date: game.date,
          dateDisplay
        };
      });
  }

  getLastFiveGamesTooltip(game: { result: number; date: string; dateDisplay: string }): string {
    const resultText = game.result === 3 ? 'Winst' : game.result === 1 ? 'Verlies' : 'Gelijkspel';
    return `Datum: ${game.dateDisplay} - ${resultText}`;
  }

  protected openChemistryModal(player: any): void {
    this.dialog.open(ChemistryModalComponent, {
      panelClass: 'chemistry-modal-panel',
      data: {
        player: { ...player, name: player.name },
        bestTeammates: this.getBestAndWorstTeammates(player)
      }
    });
  }

  private getBestAndWorstTeammates(player: any): { best: any; worst: any } {
    // Verzamel chemistry-data per teammate
    if (!player || !player.gameHistory) {
      return {
        best: { name: 'No data', gamesPlayed: 0, gamesWon: 0, gamesTied: 0, gamesLost: 0, chemistryScore: 0 },
        worst: { name: 'No data', gamesPlayed: 0, gamesWon: 0, gamesTied: 0, gamesLost: 0, chemistryScore: 0 }
      };
    }
    const chemistry: { [teammate: string]: { gamesPlayed: number; gamesWon: number; gamesTied: number; gamesLost: number } } = {};
    // Loop door alle games van deze speler
    player.gameHistory.forEach((game: any) => {
      if (!game.playerIds) return;
      // game.playerIds bevat alle spelers in deze wedstrijd
      game.playerIds.forEach((teammateId: string) => {
        if (teammateId === player.player) return; // Zichzelf overslaan
        if (!chemistry[teammateId]) {
          chemistry[teammateId] = { gamesPlayed: 0, gamesWon: 0, gamesTied: 0, gamesLost: 0 };
        }
        chemistry[teammateId].gamesPlayed++;
        if (game.result === 3) chemistry[teammateId].gamesWon++;
        else if (game.result === 2) chemistry[teammateId].gamesTied++;
        else chemistry[teammateId].gamesLost++;
      });
    });
    // Maak teammate objects
    const teammates = Object.entries(chemistry)
      .map(([name, stats]) => ({
        name: this.titleCasePipe.transform(name),
        gamesPlayed: stats.gamesPlayed,
        gamesWon: stats.gamesWon,
        gamesTied: stats.gamesTied,
        gamesLost: stats.gamesLost,
        chemistryScore: stats.gamesPlayed > 0 ? stats.gamesWon / stats.gamesPlayed : 0
      }))
      .filter(t => t.gamesPlayed >= 3); // Alleen teammates met minimaal 3 gezamenlijke wedstrijden
    const sorted = teammates.sort((a, b) => b.chemistryScore - a.chemistryScore);
    return {
      best: sorted.length > 0 ? sorted[0] : { name: 'No data', gamesPlayed: 0, gamesWon: 0, gamesTied: 0, gamesLost: 0, chemistryScore: 0 },
      worst: sorted.length > 0 ? sorted[sorted.length - 1] : { name: 'No data', gamesPlayed: 0, gamesWon: 0, gamesTied: 0, gamesLost: 0, chemistryScore: 0 }
    };
  }

  trackByGame(index: number, game: any): string {
    // Combineer datum en resultaat voor een unieke key
    return `${game.date}-${game.result}`;
  }
}