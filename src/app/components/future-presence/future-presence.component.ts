import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize, Observable } from 'rxjs';
import { GoogleSheetsService } from '../../services/google-sheets-service';
import { NextMatchService, FutureMatchInfo } from '../../services/next-match.service';

interface PlayerAttendanceStatus {
  date: string;
  status: 'Ja' | 'Nee' | null;
}

interface MatchPresenceCounts {
  date: string;
  aanwezig: number;
  afwezig: number;
}

@Component({
  selector: 'app-future-presence',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatListModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  templateUrl: './future-presence.component.html',
  styleUrl: './future-presence.component.scss'
})
export class FuturePresenceComponent implements OnInit {
  players: { name: string, position: string }[] = [];
  selectedPlayer: string | null = null;
  futureMatches: FutureMatchInfo[] = [];
  playerAttendanceStatus: PlayerAttendanceStatus[] = [];
  matchPresenceCounts: MatchPresenceCounts[] = [];
  
  isLoadingPlayers = false;
  isLoadingMatches = false;
  isLoadingStatus = false;
  isLoadingCounts = false;
  updatingCounts: { [date: string]: boolean } = {};
  savingStates: { [date: string]: boolean } = {};
  
  errorMessage: string | null = null;
  playerSelectError: string | null = null;
  
  readonly LAST_PLAYER_KEY = 'lastSelectedPlayer';
  readonly SHEET_NAME = 'Aanwezigheid';
  readonly PLAYER_SHEET_NAME = 'Spelers';

  constructor(
    private googleSheetsService: GoogleSheetsService,
    private nextMatchService: NextMatchService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadPlayers();
    this.loadFutureMatches();
  }

  loadPlayers(): void {
    this.isLoadingPlayers = true;
    this.googleSheetsService.getSheetData(this.PLAYER_SHEET_NAME)
      .pipe(finalize(() => this.isLoadingPlayers = false))
      .subscribe({
        next: (data) => {
          this.players = data.slice(1)
                             .map(row => ({ name: row[0], position: row[1] || '' }))
                             .filter(player => player.name)
                             .sort((a, b) => a.name.localeCompare(b.name));
          this.errorMessage = null;
          this.loadLastSelectedPlayer();
        },
        error: (err) => {
          console.error('Error loading players:', err);
          this.errorMessage = 'Fout bij het laden van spelers.';
        }
      });
  }

  loadFutureMatches(): void {
    this.isLoadingMatches = true;
    this.nextMatchService.getFutureMatches()
      .pipe(finalize(() => this.isLoadingMatches = false))
      .subscribe({
        next: (matches) => {
          this.futureMatches = matches;
          this.errorMessage = null;
          // Load presence counts for all matches
          this.loadMatchPresenceCounts();
          if (this.selectedPlayer) {
            this.loadPlayerAttendanceStatus();
          }
        },
        error: (err) => {
          console.error('Error loading future matches:', err);
          this.errorMessage = 'Fout bij het laden van toekomstige wedstrijden.';
        }
      });
  }

  loadLastSelectedPlayer(): void {
    const lastPlayer = localStorage.getItem(this.LAST_PLAYER_KEY);
    if (lastPlayer && this.players.some(player => player.name === lastPlayer)) {
      this.selectedPlayer = lastPlayer;
      if (this.futureMatches.length > 0) {
        this.loadPlayerAttendanceStatus();
      }
    } else {
      this.selectedPlayer = null;
      localStorage.removeItem(this.LAST_PLAYER_KEY);
    }
  }

  onPlayerSelectionChange(): void {
    this.playerSelectError = null;
    this.playerAttendanceStatus = [];
    
    if (this.selectedPlayer) {
      localStorage.setItem(this.LAST_PLAYER_KEY, this.selectedPlayer);
      if (this.futureMatches.length > 0) {
        this.loadPlayerAttendanceStatus();
      }
    } else {
      localStorage.removeItem(this.LAST_PLAYER_KEY);
      this.playerSelectError = 'Selecteer eerst een speler.';
    }
  }

  loadPlayerAttendanceStatus(): void {
    if (!this.selectedPlayer || this.futureMatches.length === 0) {
      this.playerAttendanceStatus = [];
      return;
    }

    this.isLoadingStatus = true;
    const currentPlayer = this.selectedPlayer;

    this.googleSheetsService.getSheetData(this.SHEET_NAME)
      .pipe(finalize(() => this.isLoadingStatus = false))
      .subscribe({
        next: (data) => {
          if (this.selectedPlayer === currentPlayer) {
            this.playerAttendanceStatus = this.futureMatches.map(match => {
              const formattedDate = this.formatDate(match.parsedDate!);
              const attendanceRow = data.find((row, index) =>
                index > 0 &&
                row[0] === formattedDate &&
                row[1] === currentPlayer
              );

              return {
                date: formattedDate,
                status: attendanceRow ? (attendanceRow[2] as 'Ja' | 'Nee') : null
              };
            });
          }
        },
        error: (err) => {
          console.error('Error loading attendance status:', err);
          if (this.selectedPlayer === currentPlayer) {
            this.playerAttendanceStatus = [];
            this.snackBar.open('Fout bij ophalen aanwezigheid status.', 'Sluiten', { 
              duration: 5000, 
              panelClass: ['snackbar-error'] 
            });
          }
        }
      });
  }

  loadMatchPresenceCounts(): void {
    if (this.futureMatches.length === 0) {
      this.matchPresenceCounts = [];
      return;
    }

    this.isLoadingCounts = true;

    this.googleSheetsService.getSheetData(this.SHEET_NAME)
      .pipe(finalize(() => this.isLoadingCounts = false))
      .subscribe({
        next: (data) => {
          this.matchPresenceCounts = this.futureMatches.map(match => {
            const formattedDate = this.formatDate(match.parsedDate!);
            
            // Count present and absent for this match date
            let aanwezig = 0;
            let afwezig = 0;

            data.forEach((row, index) => {
              if (index > 0 && row[0] === formattedDate) { // Skip header row
                if (row[2] === 'Ja') {
                  aanwezig++;
                } else if (row[2] === 'Nee') {
                  afwezig++;
                }
              }
            });

            return {
              date: formattedDate,
              aanwezig,
              afwezig
            };
          });
        },
        error: (err) => {
          console.error('Error loading presence counts:', err);
          this.matchPresenceCounts = [];
          this.snackBar.open('Fout bij ophalen aanwezigheid aantallen.', 'Sluiten', { 
            duration: 5000, 
            panelClass: ['snackbar-error'] 
          });
        }
      });
  }

  updateMatchPresenceCount(matchDate: string): void {
    this.updatingCounts[matchDate] = true;
    
    this.googleSheetsService.getSheetData(this.SHEET_NAME)
      .pipe(finalize(() => this.updatingCounts[matchDate] = false))
      .subscribe({
        next: (data) => {
          // Count present and absent for this specific match date
          let aanwezig = 0;
          let afwezig = 0;

          data.forEach((row, index) => {
            if (index > 0 && row[0] === matchDate) { // Skip header row
              if (row[2] === 'Ja') {
                aanwezig++;
              } else if (row[2] === 'Nee') {
                afwezig++;
              }
            }
          });

          // Update only the specific match in the array
          const matchIndex = this.matchPresenceCounts.findIndex(c => c.date === matchDate);
          if (matchIndex >= 0) {
            this.matchPresenceCounts[matchIndex] = {
              date: matchDate,
              aanwezig,
              afwezig
            };
          } else {
            // Add new entry if it doesn't exist
            this.matchPresenceCounts.push({
              date: matchDate,
              aanwezig,
              afwezig
            });
          }
        },
        error: (err) => {
          console.error('Error updating presence count for match:', matchDate, err);
        }
      });
  }

  setAttendance(matchDate: string, uiStatus: 'aanwezig' | 'afwezig'): void {
    if (!this.selectedPlayer || this.savingStates[matchDate]) {
      return;
    }

    // Convert UI values to database values
    const dbStatus: 'Ja' | 'Nee' = uiStatus === 'aanwezig' ? 'Ja' : 'Nee';

    this.savingStates[matchDate] = true;
    const currentPlayer = this.selectedPlayer;
    const rowData = [matchDate, currentPlayer, dbStatus];

    this.googleSheetsService.getSheetData(this.SHEET_NAME)
      .subscribe({
        next: (data) => {
          if (this.selectedPlayer !== currentPlayer) {
            this.savingStates[matchDate] = false;
            return;
          }

          const rowIndex = data.findIndex((row, index) =>
            index > 0 &&
            row[0] === matchDate &&
            row[1] === currentPlayer
          );

          let operation: Observable<any>;
          if (rowIndex > 0) {
            const sheetRowIndex = rowIndex + 1;
            console.log(`Updating row ${sheetRowIndex} for ${currentPlayer} on ${matchDate}`);
            operation = this.googleSheetsService.updateSheetRow(this.SHEET_NAME, sheetRowIndex, rowData);
          } else {
            console.log(`Appending row for ${currentPlayer} on ${matchDate}`);
            operation = this.googleSheetsService.appendSheetRow(this.SHEET_NAME, rowData);
          }

          operation.pipe(finalize(() => this.savingStates[matchDate] = false)).subscribe({
            next: (response) => {
              console.log('Attendance saved:', response);
              if (this.selectedPlayer === currentPlayer) {
                // Update local status
                const statusIndex = this.playerAttendanceStatus.findIndex(s => s.date === matchDate);
                if (statusIndex >= 0) {
                  this.playerAttendanceStatus[statusIndex].status = dbStatus;
                } else {
                  this.playerAttendanceStatus.push({ date: matchDate, status: dbStatus });
                }

                // Refresh presence counts only for this specific match
                this.updateMatchPresenceCount(matchDate);

                this.snackBar.open(
                  `Aanwezigheid (${dbStatus === 'Ja' ? 'Aanwezig' : 'Afwezig'}) voor ${currentPlayer} opgeslagen!`, 
                  'Ok', 
                  { duration: 3000 }
                );
              }
            },
            error: (err) => {
              console.error('Error saving attendance:', err);
              const message = (err instanceof Error) ? err.message : 'Fout bij opslaan aanwezigheid.';
              this.snackBar.open(message, 'Sluiten', { 
                duration: 5000, 
                panelClass: ['snackbar-error'] 
              });
            }
          });
        },
        error: (err) => {
          console.error('Error fetching sheet data before saving:', err);
          const message = (err instanceof Error) ? err.message : 'Kon bestaande data niet controleren, opslaan mislukt.';
          this.snackBar.open(message, 'Sluiten', { 
            duration: 5000, 
            panelClass: ['snackbar-error'] 
          });
          this.savingStates[matchDate] = false;
        }
      });
  }

  getAttendanceStatus(matchDate: string): 'aanwezig' | 'afwezig' | null {
    const status = this.playerAttendanceStatus.find(s => s.date === matchDate);
    if (!status || !status.status) return null;
    
    // Convert database values to UI values
    return status.status === 'Ja' ? 'aanwezig' : 'afwezig';
  }

  getPresenceCounts(matchDate: string): { aanwezig: number; afwezig: number } {
    const counts = this.matchPresenceCounts.find(c => c.date === matchDate);
    return counts ? { aanwezig: counts.aanwezig, afwezig: counts.afwezig } : { aanwezig: 0, afwezig: 0 };
  }

  isUpdatingCounts(matchDate: string): boolean {
    return this.updatingCounts[matchDate] || false;
  }

  isSaving(matchDate: string): boolean {
    return this.savingStates[matchDate] || false;
  }

  formatDateForDisplay(date: Date): string {
    return date.toLocaleDateString('nl-NL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
