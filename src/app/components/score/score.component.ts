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
  matchNumber: number | string;
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
            if (info && info.row) {
              const matchRow = info.row;
              this.nextMatch = {
                matchNumber: matchRow[0],
                date: info.parsedDate ? info.parsedDate.toISOString() : info.date,
                teamWhitePlayers: matchRow[2] ?? '',
                teamRedPlayers: matchRow[3] ?? '',
                teamWhiteGoals: matchRow[4],
                teamRedGoals: matchRow[5],
                zlatan: matchRow[6],
                rowNumber: info.rowNumber // direct uit NextMatchInfo
              };
              // Bouw de player objecten voor de cards
              this.teamWhitePlayers = this.parsePlayers(this.nextMatch.teamWhitePlayers, playerStats);
              this.teamRedPlayers = this.parsePlayers(this.nextMatch.teamRedPlayers, playerStats);
              const combinedPlayers = [...new Set([
                ...this.teamWhitePlayers.map(p => p.name),
                ...this.teamRedPlayers.map(p => p.name)
              ])];
              this.participatingPlayers = combinedPlayers.filter(player => !!player);
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
          this._snackBar.open('Scores en Zlatan succesvol opgeslagen!', 'OK', {
            duration: 3000
          }).afterDismissed().subscribe(() => {
            this.router.navigate(['/klassement']);
          });
        },
        error: error => {
          console.error('Error updating match scores/Zlatan in Wedstrijden sheet', error);
          this._snackBar.open('Fout bij opslaan. Probeer het opnieuw.', 'Sluiten', {
            duration: 5000
          });
        }
      });
    } else {
      this._snackBar.open('Vul eerst beide scores in.', 'OK', {
        duration: 3000
      });
    }
  }
}