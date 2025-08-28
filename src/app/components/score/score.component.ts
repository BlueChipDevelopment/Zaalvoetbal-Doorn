import { Component, OnInit } from '@angular/core';
import { GoogleSheetsService } from '../../services/google-sheets-service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { NextMatchService, NextMatchInfo } from '../../services/next-match.service';
import { NextMatchInfoComponent } from '../next-match-info/next-match-info.component';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { PlayerCardComponent } from '../player-card/player-card.component';
import { GameStatisticsService } from '../../services/game.statistics.service';
import { Player } from '../../interfaces/IPlayer';

interface Match {
  rowNumber?: number; // Make optional
  matchNumber: number;
  date: string;
  teamWhitePlayers: string;
  teamRedPlayers: string;
  teamWhiteGoals?: number | string;
  teamRedGoals?: number | string;
  zlatan?: string;
}

@Component({
  selector: 'app-score',
  templateUrl: './score.component.html',
  styleUrls: ['./score.component.scss'],
  standalone: true, 
  imports: [
    CommonModule,
    FormsModule,
    NextMatchInfoComponent,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    PlayerCardComponent,
  ],
})
export class ScoreComponent implements OnInit {
  nextMatch: Match | null = null;
  nextMatchInfo: NextMatchInfo | null = null;
  teamWhitePlayers: Player[] = [];
  teamRedPlayers: Player[] = [];
  participatingPlayers: string[] = [];
  whiteGoals: number | null = null;
  redGoals: number | null = null;
  selectedZlatan: string | null = null;
  isLoading: boolean = true;
  errorMessage: string | null = null;

  constructor(
    private googleSheetsService: GoogleSheetsService,
    private _snackBar: MatSnackBar,
    private router: Router,
    private nextMatchService: NextMatchService,
    private gameStatisticsService: GameStatisticsService 
  ) {}

  ngOnInit(): void {
    this.loadNextMatch();
  }

  private loadNextMatch(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.nextMatch = null;
    this.whiteGoals = null;
    this.redGoals = null;
    this.selectedZlatan = null;
    this.participatingPlayers = [];

    // Haal eerst alle spelersstats op via gameStatisticsService
    this.gameStatisticsService.getFullPlayerStats().subscribe({
      next: (playerStats: Player[]) => {
        this.nextMatchService.getNextMatchInfo().subscribe({
          next: (info) => {
            this.nextMatchInfo = info;
            if (info && info.wedstrijd) {
              const wedstrijd = info.wedstrijd;
              this.nextMatch = {
                matchNumber: wedstrijd.id ?? 0,
                date: info.parsedDate ? info.parsedDate.toISOString() : info.date,
                teamWhitePlayers: wedstrijd.teamWit ?? '',
                teamRedPlayers: wedstrijd.teamRood ?? '',
                teamWhiteGoals: wedstrijd.scoreWit ?? undefined,
                teamRedGoals: wedstrijd.scoreRood ?? undefined,
                zlatan: wedstrijd.zlatan,
                rowNumber: info.rowNumber // direct uit NextMatchInfo
              };
              // Bouw de player objecten voor de cards
              if (this.nextMatch) {
                this.teamWhitePlayers = this.parsePlayers(this.nextMatch.teamWhitePlayers || '', playerStats);
                this.teamRedPlayers = this.parsePlayers(this.nextMatch.teamRedPlayers || '', playerStats);
                const combinedPlayers = [...new Set([
                  ...this.teamWhitePlayers.map(p => p.name),
                  ...this.teamRedPlayers.map(p => p.name)
                ])];
                this.participatingPlayers = combinedPlayers.filter(player => !!player);
              }
              this.isLoading = false;
            } else {
              this.errorMessage = 'Geen aankomende wedstrijd gevonden.';
              this.isLoading = false;
            }
          },
          error: error => {
            this.errorMessage = 'Fout bij het laden van wedstrijden.';
            this.isLoading = false;
          }
        });
      },
      error: error => {
        this.errorMessage = 'Fout bij het laden van spelers.';
        this.isLoading = false;
      }
    });
  }

  /**
   * Zet een comma separated string van spelersnamen om naar een array van Player objecten
   */
  private parsePlayers(playerString: string, playerStats: any[]): Player[] {
    return (playerString ?? '')
      .split(',')
      .map((player: string) => player.trim())
      .filter((trimmed: string) => !!trimmed) // Lege namen negeren
      .map((trimmed: string) => {
        const match = playerStats.find(p =>
          (p.name && p.name.trim().toLowerCase() === trimmed.toLowerCase()) ||
          (p.player && p.player.trim().toLowerCase() === trimmed.toLowerCase())
        );
        if (!match) {
          console.warn('No match for:', trimmed, 'in playerStats:', playerStats.map(p => p.name || p.player));
        } else {
          console.log('Match found for:', trimmed, match);
        }
        return match || { name: trimmed, position: '', rating: null };
      });
  }

  submitScores(): void {
    if (this.nextMatch && this.whiteGoals !== null && this.redGoals !== null) {
      const rowIndexToUpdate = this.nextMatch.rowNumber;

      if (!rowIndexToUpdate) {
        this._snackBar.open('Kan wedstrijd niet identificeren voor het opslaan van scores.', 'OK', {
          duration: 5000
        });
        return;
      }

      // Extra validatie: controleer of we de juiste wedstrijd hebben
      const matchNumber = this.nextMatch.matchNumber;
      const seizoen = this.nextMatchInfo?.wedstrijd?.seizoen;
      const absoluteId = this.nextMatchInfo?.wedstrijd?.id; // Gebruik het absolute ID voor vergelijking
      
      if (seizoen && absoluteId) {
        // Dubbele controle via wedstrijdenService
        this.nextMatchService.getNextMatchInfo().subscribe({
          next: (currentMatchInfo) => {
            // Vergelijk op seizoen + absolute ID (stabiel)
            if (currentMatchInfo?.wedstrijd?.seizoen === seizoen && 
                currentMatchInfo?.wedstrijd?.id === absoluteId) {
              // Veilig om scores op te slaan
              this.performScoreUpdate(rowIndexToUpdate);
            } else {
              this._snackBar.open('Wedstrijdgegevens zijn veranderd. Herlaad de pagina.', 'OK', {
                duration: 5000
              });
            }
          },
          error: () => {
            // Fallback: gebruik de oorspronkelijke methode
            this.performScoreUpdate(rowIndexToUpdate);
          }
        });
      } else {
        // Fallback voor bestaande wedstrijden zonder seizoen of ID
        this.performScoreUpdate(rowIndexToUpdate);
      }
    } else {
      this._snackBar.open('Vul eerst beide scores in.', 'OK', {
        duration: 3000
      });
    }
  }

  private performScoreUpdate(rowIndexToUpdate: number): void {
    // Log voor debugging en monitoring
    const matchNumber = this.nextMatch?.matchNumber;
    const seizoen = this.nextMatchInfo?.wedstrijd?.seizoen;
    console.log(`💾 Scores opslaan - Seizoen: ${seizoen || 'onbekend'}, Wedstrijd: ${matchNumber}, Rij: ${rowIndexToUpdate}`);
    
    const updateData = [
      {
        range: `Wedstrijden!E${rowIndexToUpdate}:G${rowIndexToUpdate}`,
        values: [
          [this.whiteGoals, this.redGoals, this.selectedZlatan || '']
        ]
      }
    ];

    this.googleSheetsService.batchUpdateSheet(updateData).subscribe({
      next: () => {
        console.log(`✅ Scores succesvol opgeslagen voor ${seizoen || 'onbekend'} wedstrijd ${matchNumber}`);
        this._snackBar.open('Scores en Zlatan succesvol opgeslagen!', 'OK', {
          duration: 3000
        }).afterDismissed().subscribe(() => {
          this.router.navigate(['/klassement']);
        });
      },
      error: error => {
        console.error(`❌ Fout bij opslaan scores voor ${seizoen || 'onbekend'} wedstrijd ${matchNumber}:`, error);
        this._snackBar.open('Fout bij opslaan. Probeer het opnieuw.', 'Sluiten', {
          duration: 5000
        });
      }
    });
  }
}