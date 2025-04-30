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
  ],
})
export class ScoreComponent implements OnInit {
  nextMatch: Match | null = null;
  nextMatchInfo: NextMatchInfo | null = null;
  teamWhitePlayers: string[] = [];
  teamRedPlayers: string[] = [];
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
    private nextMatchService: NextMatchService
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
            zlatan: matchRow[6]
          };
          this.teamWhitePlayers = (this.nextMatch.teamWhitePlayers ?? '').split(',').map((player: string) => player.trim()).filter(p => p);
          this.teamRedPlayers = (this.nextMatch.teamRedPlayers ?? '').split(',').map((player: string) => player.trim()).filter(p => p);
          const combinedPlayers = [...new Set([...this.teamWhitePlayers, ...this.teamRedPlayers])];
          this.participatingPlayers = combinedPlayers.filter(player => !!player);
        } else {
          this.errorMessage = 'Geen aankomende wedstrijd gevonden.';
        }
        this.isLoading = false;
      },
      error: error => {
        this.errorMessage = 'Fout bij het laden van wedstrijden.';
        this.isLoading = false;
      }
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
            this.router.navigate(['/leaderboard']);
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