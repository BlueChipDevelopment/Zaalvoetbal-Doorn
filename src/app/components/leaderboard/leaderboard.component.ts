import { Component, OnInit, HostListener } from '@angular/core';
import { GameStatisticsService } from '../../services/game.statistics.service';
import { TitleCasePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { ChemistryModalComponent } from './chemistry-modal.component';
import { MatError } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [
    TitleCasePipe,
    ChemistryModalComponent,
    MatError,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    CommonModule, 
    MatCardModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule
  ],
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss']
})
export class LeaderboardComponent implements OnInit {
  leaderboard: any[] = [];
  availableSeasons: string[] = [];
  selectedSeason: string | null = null;
  isMobile = false;
  isLoading = true; 
  public errorMessage: string | null = null;

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
    this.loadSeasonsAndLeaderboard();
  }

  private loadSeasonsAndLeaderboard(): void {
    this.isLoading = true;
    
    // Laad eerst de beschikbare seizoenen
    this.gameStatisticsService.getAvailableSeasons().subscribe({
      next: (seasons: string[]) => {
        this.availableSeasons = seasons;
        
        // Selecteer het meest recente seizoen als default
        if (seasons.length > 0) {
          this.selectedSeason = seasons[0]; // Eerste seizoen is het meest recente
        }
        
        // Laad het leaderboard voor het geselecteerde seizoen
        this.loadLeaderboard();
      },
      error: (error: any) => {
        console.error('Error loading seasons:', error);
        this.errorMessage = 'Fout bij het laden van seizoenen.';
        this.isLoading = false;
      }
    });
  }

  private checkScreenSize(): void {
    this.isMobile = window.innerWidth < 768;
  }

  private loadLeaderboard(): void {
    this.isLoading = true;
    this.gameStatisticsService.getFullPlayerStats(this.selectedSeason).subscribe({
      next: (leaderboard: any[]) => {
        this.leaderboard = leaderboard;
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading leaderboard:', error);
        this.errorMessage = 'Fout bij het laden van het klassement.';
        this.isLoading = false;
      }
    });
  }

  public onSeasonChange(): void {
    this.loadLeaderboard();
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