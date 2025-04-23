import { Component, OnInit } from '@angular/core';
import { GoogleSheetsService } from '../../services/google-sheets-service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

interface Match {
  rowNumber: number;
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
  styleUrls: ['./score.component.scss']
})
export class ScoreComponent implements OnInit {
  nextMatch: Match | null = null;
  teamWhitePlayers: string[] = [];
  teamRedPlayers: string[] = [];
  participatingPlayers: string[] = [];
  whiteGoals: number | null = null;
  redGoals: number | null = null;
  selectedZlatan: string | null = null;
  isLoading: boolean = true;
  errorMessage: string | null = null;

  private readonly MATCH_NUMBER_COL = 0;
  private readonly DATE_COL = 1;
  private readonly WHITE_PLAYERS_COL = 2;
  private readonly RED_PLAYERS_COL = 3;
  private readonly WHITE_GOALS_COL = 4;
  private readonly RED_GOALS_COL = 5;
  private readonly ZLATAN_COL = 6;

  constructor(
    private googleSheetsService: GoogleSheetsService,
    private _snackBar: MatSnackBar,
    private router: Router
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

    this.googleSheetsService.getSheetData('Wedstrijden').subscribe({
      next: (data: any[][]) => {
        console.log('Wedstrijden Sheet Data:', data);
        const nextMatchRowIndex = data.findIndex((row, index) => index > 0 && !row[this.WHITE_GOALS_COL] && !row[this.RED_GOALS_COL]);

        if (nextMatchRowIndex > 0) {
          const matchRow = data[nextMatchRowIndex];
          const rowNumber = nextMatchRowIndex + 1;

          console.log(`Raw data for date column (${this.DATE_COL}) in row ${rowNumber}:`, matchRow[this.DATE_COL]);

          this.nextMatch = {
            rowNumber: rowNumber,
            matchNumber: matchRow[this.MATCH_NUMBER_COL],
            date: matchRow[this.DATE_COL],
            teamWhitePlayers: matchRow[this.WHITE_PLAYERS_COL] || '',
            teamRedPlayers: matchRow[this.RED_PLAYERS_COL] || '',
            teamWhiteGoals: matchRow[this.WHITE_GOALS_COL],
            teamRedGoals: matchRow[this.RED_GOALS_COL],
            zlatan: matchRow[this.ZLATAN_COL]
          };

          console.log('Assigned date value to nextMatch.date:', this.nextMatch.date);

          this.teamWhitePlayers = (this.nextMatch.teamWhitePlayers).split(',').map((player: string) => player.trim()).filter(p => p);
          this.teamRedPlayers = (this.nextMatch.teamRedPlayers).split(',').map((player: string) => player.trim()).filter(p => p);

          const combinedPlayers = [...new Set([...this.teamWhitePlayers, ...this.teamRedPlayers])];
          this.participatingPlayers = combinedPlayers.filter(player => !!player);

          console.log('Next Match Found:', this.nextMatch);
          console.log('Team White Players:', this.teamWhitePlayers);
          console.log('Team Red Players:', this.teamRedPlayers);
          console.log('Participating Players:', this.participatingPlayers);
        } else {
          console.log('No upcoming match found.');
          this.errorMessage = 'Geen aankomende wedstrijd gevonden.';
        }
        this.isLoading = false;
      },
      error: error => {
        console.error('Error loading Wedstrijden sheet', error);
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