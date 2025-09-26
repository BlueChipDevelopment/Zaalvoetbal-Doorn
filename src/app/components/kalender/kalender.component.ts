import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { finalize, Observable, forkJoin } from 'rxjs';
import { GoogleSheetsService } from '../../services/google-sheets-service';
import { AttendanceService } from '../../services/attendance.service';
import { PlayerService } from '../../services/player.service';
import { PlayerSheetData } from '../../interfaces/IPlayerSheet';
import { NextMatchService, FutureMatchInfo } from '../../services/next-match.service';
import { AttendanceStatus } from '../../interfaces/IAttendance';
import { trigger, state, style, transition, animate } from '@angular/animations';

interface PlayerAttendanceStatus {
  date: string;
  status: AttendanceStatus | null;
}

interface MatchPresenceCounts {
  date: string;
  aanwezig: number;
  afwezig: number;
}

interface PlayerAttendance {
  name: string;
  status: AttendanceStatus;
  position?: string;
}

interface MatchAttendanceDetails {
  date: string;
  aanwezig: PlayerAttendance[];
  afwezig: PlayerAttendance[];
  geenReactie: { name: string; position?: string; actief: boolean; }[];
}

interface ExtendedFutureMatchInfo extends FutureMatchInfo {
  formattedDate: string;
}

@Component({
  selector: 'app-kalender',
  standalone: true,
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ height: '0', opacity: 0, overflow: 'hidden' }),
        animate('300ms ease-in-out', style({ height: '*', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-in-out', style({ height: '0', opacity: 0 }))
      ])
    ])
  ],
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatListModule,
    MatButtonToggleModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatChipsModule,
    MatExpansionModule,
    MatTooltipModule,
    MatDividerModule
  ],
  templateUrl: './kalender.component.html',
  styleUrl: './kalender.component.scss'
})
export class KalenderComponent implements OnInit {
  players: PlayerSheetData[] = [];
  selectedPlayer: string | null = null;
  futureMatches: ExtendedFutureMatchInfo[] = [];
  playerAttendanceStatus: PlayerAttendanceStatus[] = [];
  matchPresenceCounts: MatchPresenceCounts[] = [];
  matchAttendanceDetails: MatchAttendanceDetails[] = [];
  expandedMatches: { [date: string]: boolean } = {};
  
  // Store all attendance records for reuse
  private allAttendanceRecords: any[] = [];
  
  isLoadingPlayers = false;
  isLoadingMatches = false;
  isLoadingStatus = false;
  isLoadingCounts = false;
  updatingCounts: { [date: string]: boolean } = {};
  savingStates: { [date: string]: boolean } = {};
  
  errorMessage: string | null = null;
  playerSelectError: string | null = null;
  
  readonly LAST_PLAYER_KEY = 'lastSelectedPlayer';

  // Central loading state - component is ready when initial data is loaded
  get isLoading(): boolean {
    return this.isLoadingPlayers || this.isLoadingMatches || this.isLoadingCounts;
  }

  constructor(
    private googleSheetsService: GoogleSheetsService,
    private attendanceService: AttendanceService,
    private playerService: PlayerService,
    private nextMatchService: NextMatchService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadPlayers();
    this.loadFutureMatches();
  }

  loadPlayers(): void {
    this.isLoadingPlayers = true;
    this.playerService.getPlayers()
      .pipe(finalize(() => this.isLoadingPlayers = false))
      .subscribe({
        next: (players) => {
          this.players = players;
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
          this.futureMatches = matches.map(match => ({
            ...match,
            formattedDate: match.parsedDate ? this.formatDate(match.parsedDate) : ''
          }));
          this.errorMessage = null;
          // Load all attendance data using the attendance service (single cached call)
          this.loadAllAttendanceData();
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
      // Player attendance status will be loaded by loadAllAttendanceData() when matches are loaded
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
        this.loadPlayerAttendanceStatusFromStoredData();
      }
    } else {
      localStorage.removeItem(this.LAST_PLAYER_KEY);
      this.playerSelectError = 'Selecteer eerst een speler.';
    }
  }

  loadAllAttendanceData(): void {
    if (this.futureMatches.length === 0) {
      this.matchPresenceCounts = [];
      this.matchAttendanceDetails = [];
      return;
    }

    this.isLoadingCounts = true;

    // Get all attendance records once and store them for reuse
    this.attendanceService.getAttendanceRecords({ futureOnly: false })
      .pipe(finalize(() => this.isLoadingCounts = false))
      .subscribe({
        next: (allRecords) => {
          // Store for reuse
          this.allAttendanceRecords = allRecords;
          
          // Process match presence counts
          this.processMatchPresenceCounts();
          
          // Load detailed attendance for all matches
          this.loadMatchAttendanceDetailsFromService();
          
          // Load player attendance status if a player is selected
          if (this.selectedPlayer) {
            this.loadPlayerAttendanceStatusFromStoredData();
          }
        },
        error: (err) => {
          console.error('Error loading attendance data:', err);
          this.matchPresenceCounts = [];
          this.snackBar.open('Fout bij ophalen aanwezigheid aantallen.', 'Sluiten', { 
            duration: 5000, 
            panelClass: ['futsal-notification', 'futsal-notification-error'] 
          });
        }
      });
  }

  private processMatchPresenceCounts(): void {
    const futureDates = this.futureMatches.map(match => this.formatDate(match.parsedDate!));
    
    this.matchPresenceCounts = futureDates.map(date => {
      const dateRecords = this.allAttendanceRecords.filter(record => record.date === date);
      return {
        date,
        aanwezig: dateRecords.filter(r => r.status === 'Ja').length,
        afwezig: dateRecords.filter(r => r.status === 'Nee').length
      };
    });
  }

  loadPlayerAttendanceStatusFromStoredData(): void {
    if (!this.selectedPlayer || this.futureMatches.length === 0) {
      this.playerAttendanceStatus = [];
      return;
    }

    const currentPlayer = this.selectedPlayer;
    const playerRecords = this.allAttendanceRecords.filter(record => 
      record.playerName === currentPlayer
    );

    this.playerAttendanceStatus = this.futureMatches.map(match => {
      const formattedDate = this.formatDate(match.parsedDate!);
      const attendanceRecord = playerRecords.find(record => 
        record.date === formattedDate
      );

      return {
        date: formattedDate,
        status: attendanceRecord?.status || null
      };
    });
  }

  loadMatchAttendanceDetailsFromService(): void {
    const futureDates = this.futureMatches.map(match => this.formatDate(match.parsedDate!));
    const detailRequests = futureDates.map(date => 
      this.attendanceService.getMatchAttendanceDetails(date)
    );

    // Use forkJoin to get all match details in parallel, but from cached data
    forkJoin(detailRequests).subscribe({
        next: (allDetails) => {
          this.matchAttendanceDetails = allDetails.map(details => ({
            date: details.date,
            aanwezig: details.present.map(p => ({ 
              name: p.name, 
              status: 'Ja' as const, 
              position: p.position 
            })),
            afwezig: details.absent.map(p => ({ 
              name: p.name, 
              status: 'Nee' as const, 
              position: p.position 
            })),
            geenReactie: details.noResponse.map(p => ({ 
              name: p.name, 
              position: p.position, 
              actief: p.playerData?.actief || true 
            }))
          }));
        },
        error: (err) => {
          console.error('Error loading attendance details:', err);
          this.matchAttendanceDetails = [];
        }
      });
  }

  loadPlayerAttendanceStatus(): void {
    if (!this.selectedPlayer || this.futureMatches.length === 0) {
      this.playerAttendanceStatus = [];
      return;
    }

    this.isLoadingStatus = true;
    const currentPlayer = this.selectedPlayer;

    // Use attendance service to get player attendance for all future dates
    this.attendanceService.getAttendanceForPlayer(currentPlayer)
      .pipe(finalize(() => this.isLoadingStatus = false))
      .subscribe({
        next: (attendanceRecords) => {
          if (this.selectedPlayer === currentPlayer) {
            this.playerAttendanceStatus = this.futureMatches.map(match => {
              const formattedDate = this.formatDate(match.parsedDate!);
              const attendanceRecord = attendanceRecords.find(record => 
                record.date === formattedDate
              );

              return {
                date: formattedDate,
                status: attendanceRecord?.status || null
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
              panelClass: ['futsal-notification', 'futsal-notification-error'] 
            });
          }
        }
      });
  }

  updateMatchPresenceCount(matchDate: string): void {
    this.updatingCounts[matchDate] = true;
    
    // Use attendance service to get updated counts for specific match
    this.attendanceService.getMatchAttendanceOverviews({ date: matchDate })
      .pipe(finalize(() => this.updatingCounts[matchDate] = false))
      .subscribe({
        next: (overviews) => {
          if (overviews.length > 0) {
            const overview = overviews[0];
            
            // Update only the specific match in the array
            const matchIndex = this.matchPresenceCounts.findIndex(c => c.date === matchDate);
            if (matchIndex >= 0) {
              this.matchPresenceCounts[matchIndex] = {
                date: matchDate,
                aanwezig: overview.presentCount,
                afwezig: overview.absentCount
              };
            } else {
              // Add new entry if it doesn't exist
              this.matchPresenceCounts.push({
                date: matchDate,
                aanwezig: overview.presentCount,
                afwezig: overview.absentCount
              });
            }
          }
        },
        error: (err) => {
          console.error('Error updating presence count for match:', matchDate, err);
        }
      });
  }

  updateMatchAttendanceDetails(matchDate: string): void {
    this.attendanceService.getMatchAttendanceDetails(matchDate)
      .subscribe({
        next: (details) => {
          // Update only the specific match in the array
          const matchIndex = this.matchAttendanceDetails.findIndex(m => m.date === matchDate);
          
          const matchDetails = {
            date: matchDate,
            aanwezig: details.present.map(p => ({ 
              name: p.name, 
              status: 'Ja' as const, 
              position: p.position 
            })),
            afwezig: details.absent.map(p => ({ 
              name: p.name, 
              status: 'Nee' as const, 
              position: p.position 
            })),
            geenReactie: details.noResponse.map(p => ({ 
              name: p.name, 
              position: p.position, 
              actief: p.playerData?.actief || true 
            }))
          };

          if (matchIndex >= 0) {
            this.matchAttendanceDetails[matchIndex] = matchDetails;
          } else {
            // Add new entry if it doesn't exist
            this.matchAttendanceDetails.push(matchDetails);
          }
        },
        error: (err) => {
          console.error('Error updating attendance details for match:', matchDate, err);
        }
      });
  }

  setAttendance(matchDate: string, uiStatus: 'aanwezig' | 'afwezig'): void {
    if (!this.selectedPlayer || this.savingStates[matchDate]) {
      return;
    }

    // Convert UI values to database values
    const dbStatus: AttendanceStatus = uiStatus === 'aanwezig' ? 'Ja' : 'Nee';

    this.savingStates[matchDate] = true;
    const currentPlayer = this.selectedPlayer;

    // Use attendance service to set attendance
    this.attendanceService.setAttendance({
      date: matchDate,
      playerName: currentPlayer,
      status: dbStatus
    })
    .pipe(finalize(() => this.savingStates[matchDate] = false))
    .subscribe({
      next: (response) => {
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
          this.updateMatchAttendanceDetails(matchDate);

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
          panelClass: ['futsal-notification', 'futsal-notification-error'] 
        });
      }
    });
  }

  getAttendanceStatus(matchDate: string): 'aanwezig' | 'afwezig' | null {
    const status = this.playerAttendanceStatus.find(s => s.date === matchDate);
    if (!status || !status.status) return null;
    
    // Convert database values to UI values
    return status.status === 'Ja' ? 'aanwezig' : 'afwezig';
  }

  getPresenceCounts(matchDate: string): { aanwezig: number; afwezig: number; geenReactie: number } {
    const counts = this.matchPresenceCounts.find(c => c.date === matchDate);
    const details = this.getAttendanceDetails(matchDate);
    
    const aanwezig = counts ? counts.aanwezig : 0;
    const afwezig = counts ? counts.afwezig : 0;
    const geenReactie = details ? details.geenReactie.length : 0;
    
    return { aanwezig, afwezig, geenReactie };
  }

  getAttendanceDetails(matchDate: string): MatchAttendanceDetails | null {
    return this.matchAttendanceDetails.find(details => details.date === matchDate) || null;
  }

  toggleMatchExpansion(matchDate: string): void {
    this.expandedMatches[matchDate] = !this.expandedMatches[matchDate];
  }

  isMatchExpanded(matchDate: string): boolean {
    return this.expandedMatches[matchDate] || false;
  }

  getPlayerInitials(name: string): string {
    return name.split(' ').map(n => n.charAt(0).toUpperCase()).join('').substring(0, 2);
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

  trackByMatchDate(index: number, match: ExtendedFutureMatchInfo): string {
    return match.formattedDate || match.date;
  }
}
