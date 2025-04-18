import { Component, OnInit } from '@angular/core';
import { GoogleSheetsService } from '../../services/google-sheets-service';

// Define an interface for better type safety
interface Match {
  rowNumber: number;
  matchNumber: number | string; // Add matchNumber
  date: string;
  teamWhitePlayers: string;
  teamRedPlayers: string;
  teamWhiteGoals?: number | string; // Allow string for empty cells
  teamRedGoals?: number | string; // Allow string for empty cells
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
  whiteGoals: number | null = null;
  redGoals: number | null = null;
  isLoading: boolean = true;
  errorMessage: string | null = null;

  // Define column indices based on 'Wedstrijden' sheet
  private readonly MATCH_NUMBER_COL = 0; // Assuming this is the match number column
  private readonly DATE_COL = 1; // Assuming this is the date column
  private readonly WHITE_PLAYERS_COL = 2;
  private readonly RED_PLAYERS_COL = 3;
  private readonly WHITE_GOALS_COL = 4;
  private readonly RED_GOALS_COL = 5;

  constructor(private googleSheetsService: GoogleSheetsService) {}

  ngOnInit(): void {
    this.loadNextMatch();
  }

  private loadNextMatch(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.nextMatch = null; // Reset previous match
    this.whiteGoals = null;
    this.redGoals = null;

    this.googleSheetsService.getSheetData('Wedstrijden').subscribe({
      next: (data: any[][]) => {
        console.log('Wedstrijden Sheet Data:', data);
        // Find the first row (after header) where scores are empty
        // Start from index 1 to skip header row
        const nextMatchRowIndex = data.findIndex((row, index) => index > 0 && !row[this.WHITE_GOALS_COL] && !row[this.RED_GOALS_COL]);

        if (nextMatchRowIndex > 0) {
          const matchRow = data[nextMatchRowIndex];
          const rowNumber = nextMatchRowIndex + 1; // Sheet row number is index + 1

          // Log the raw data for the date column
          console.log(`Raw data for date column (${this.DATE_COL}) in row ${rowNumber}:`, matchRow[this.DATE_COL]);

          this.nextMatch = {
            rowNumber: rowNumber,
            matchNumber: matchRow[this.MATCH_NUMBER_COL], // Store match number
            date: matchRow[this.DATE_COL], // Use DATE_COL (index 1)
            teamWhitePlayers: matchRow[this.WHITE_PLAYERS_COL] || '',
            teamRedPlayers: matchRow[this.RED_PLAYERS_COL] || '',
            teamWhiteGoals: matchRow[this.WHITE_GOALS_COL],
            teamRedGoals: matchRow[this.RED_GOALS_COL]
          };

          // Log the assigned date value
          console.log('Assigned date value to nextMatch.date:', this.nextMatch.date);

          this.teamWhitePlayers = (this.nextMatch.teamWhitePlayers).split(',').map((player: string) => player.trim()).filter(p => p); // Filter empty strings
          this.teamRedPlayers = (this.nextMatch.teamRedPlayers).split(',').map((player: string) => player.trim()).filter(p => p); // Filter empty strings

          console.log('Next Match Found:', this.nextMatch);
          console.log('Team White Players:', this.teamWhitePlayers);
          console.log('Team Red Players:', this.teamRedPlayers);
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
      // Prepare the row data to update - only update the score columns
      // We need the original row data structure, but only scores are changing
      // It's safer to update specific cells/range if the service supports it,
      // but updateSheetRow expects the full row. Let's construct it carefully.
      // Fetching the row again might be safer, but let's try constructing it.

      // Assuming the service needs the full row array for updateSheetRow
      const updatedRowData: any[] = [];
      updatedRowData[this.MATCH_NUMBER_COL] = this.nextMatch.rowNumber; // Preserve match number if it exists
      updatedRowData[this.DATE_COL] = this.nextMatch.date;
      updatedRowData[this.WHITE_PLAYERS_COL] = this.nextMatch.teamWhitePlayers;
      updatedRowData[this.RED_PLAYERS_COL] = this.nextMatch.teamRedPlayers;
      updatedRowData[this.WHITE_GOALS_COL] = this.whiteGoals;
      updatedRowData[this.RED_GOALS_COL] = this.redGoals;
      // Add any other columns if they exist in the sheet and need preserving

      // Use the correct row number (index + 1)
      const rowIndexToUpdate = this.nextMatch.rowNumber;

      this.googleSheetsService.updateSheetRow('Wedstrijden', rowIndexToUpdate, updatedRowData).subscribe({
        next: () => {
          alert('Scores succesvol bijgewerkt!');
          this.loadNextMatch(); // Reload to find the next match
        },
        error: error => {
          console.error('Error updating match in Wedstrijden sheet', error);
          alert('Scores bijwerken mislukt. Probeer het opnieuw.');
        }
      });
    } else {
      alert('Vul beide scores in voordat je ze verstuurt.');
    }
  }
}