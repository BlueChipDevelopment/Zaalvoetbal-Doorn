import { Component, OnInit } from '@angular/core';
import { GoogleSheetsService } from '../../services/google-sheets-service';
import { PlayerService } from '../../services/player.service';
import { PlayerSheetData } from '../../interfaces/IPlayerSheet';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { NextMatchService, NextMatchInfo } from '../../services/next-match.service';
import { NextMatchInfoComponent } from '../next-match-info/next-match-info.component';
import { PlayerCardComponent } from '../player-card/player-card.component';
import { GameStatisticsService } from '../../services/game.statistics.service';
import { Player } from '../../interfaces/IPlayer';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    RouterModule,
    NextMatchInfoComponent,
    PlayerCardComponent,
  ],
  templateUrl: './attendance.component.html',
  styleUrls: ['./attendance.component.scss']
})
export class AttendanceComponent implements OnInit {
  players: PlayerSheetData[] = [];
  selectedPlayer: string | null = null;
  nextGameDate: Date | null = null;
  nextGameDateRaw: string | null = null;
  nextMatchInfo: NextMatchInfo | null = null;
  isLoadingPlayers: boolean = false;
  isLoadingStatus: boolean = false;
  attendanceStatus: 'Ja' | 'Nee' | 'Misschien' | null = null;
  attendanceList: { speler: string, status: 'Ja' | 'Nee' | 'Misschien', playerObj?: Player }[] = [];
  presentCount = 0;
  absentCount = 0;
  readonly LAST_PLAYER_KEY = 'lastSelectedPlayer';
  readonly SHEET_NAME = 'Aanwezigheid';
  public errorMessage: string | null = null; // Algemene foutmeldingen (API, etc)
  public playerSelectError: string | null = null; // Alleen voor veldvalidatie spelerselectie

  pushPermissionGranted = false;
  pushPermissionLoading = false;
  pushPermissionError: string | null = null;

  constructor(
    private googleSheetsService: GoogleSheetsService,
    private playerService: PlayerService,
    private snackBar: MatSnackBar,
    private nextMatchService: NextMatchService,
    private gameStatisticsService: GameStatisticsService
  ) {}

  ngOnInit(): void {
    this.isLoadingPlayers = true;
    this.nextMatchService.getNextMatchInfo().subscribe({
      next: (info) => {
        this.nextMatchInfo = info;
        this.nextGameDate = info?.parsedDate || null;
        this.nextGameDateRaw = info?.date || null;
        this.errorMessage = null;
        this.loadPlayers();
        this.loadAttendanceList();
      },
      error: (err) => {
        this.nextMatchInfo = null;
        this.nextGameDate = null;
        this.nextGameDateRaw = null;
        this.isLoadingPlayers = false;
        this.errorMessage = 'Fout bij het laden van wedstrijden.';
      }
    });
  }

  loadAttendanceList(): void {
    if (!this.nextGameDate) {
      this.attendanceList = [];
      this.presentCount = 0;
      this.absentCount = 0;
      return;
    }
    const formattedDate = this.formatDate(this.nextGameDate);
    this.googleSheetsService.getSheetData(this.SHEET_NAME).subscribe({
      next: (data) => {
        this.gameStatisticsService.getFullPlayerStats().subscribe((playerStats: Player[]) => {
          this.attendanceList = data
            .filter((row, idx) => idx > 0 && row[0] === formattedDate)
            .map(row => {
              const spelerNaam = row[1];
              const foundPlayer = playerStats.find((p: Player) => p.name === spelerNaam);
              const playerMeta = this.players.find(p => p.name === spelerNaam);
              const playerObj = foundPlayer || {
                name: spelerNaam,
                position: playerMeta ? playerMeta.position : '',
                rating: 1,
                gamesPlayed: 0,
                totalPoints: 0,
                wins: 0,
                losses: 0,
                ties: 0,
                winRatio: 0,
                gameHistory: [],
                zlatanPoints: 0,
                ventielPoints: 0,
                actief: true
              };
              return { speler: spelerNaam, status: row[2] as 'Ja' | 'Nee' | 'Misschien', playerObj };
            });
          this.presentCount = this.attendanceList.filter(item => item.status === 'Ja').length;
          this.absentCount = this.attendanceList.filter(item => item.status === 'Nee').length;
          this.errorMessage = null;
        });
      },
      error: (err) => {
        this.attendanceList = [];
        this.presentCount = 0;
        this.absentCount = 0;
        this.errorMessage = 'Fout bij het laden van aanwezigheid.';
      }
    });
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

  loadLastSelectedPlayer(): void {
    const lastPlayer = localStorage.getItem(this.LAST_PLAYER_KEY);
    if (lastPlayer && this.players.some(player => player.name === lastPlayer)) {
      this.selectedPlayer = lastPlayer;
      this.fetchCurrentAttendanceStatus();
    } else {
      this.selectedPlayer = null;
      this.attendanceStatus = null;
      localStorage.removeItem(this.LAST_PLAYER_KEY);
    }
  }

  onPlayerSelectionChange(): void {
    this.attendanceStatus = null;
    this.playerSelectError = null;
    if (this.selectedPlayer) {
      localStorage.setItem(this.LAST_PLAYER_KEY, this.selectedPlayer);
      this.fetchCurrentAttendanceStatus();
    } else {
      localStorage.removeItem(this.LAST_PLAYER_KEY);
      this.playerSelectError = 'Selecteer eerst een speler.';
    }
  }

  fetchCurrentAttendanceStatus(): void {
    if (!this.selectedPlayer || !this.nextGameDate) {
      this.attendanceStatus = null;
      return;
    }
    this.isLoadingStatus = true;
    const formattedDate = this.formatDate(this.nextGameDate);
    const currentPlayer = this.selectedPlayer;

    this.googleSheetsService.getSheetData(this.SHEET_NAME)
      .pipe(finalize(() => this.isLoadingStatus = false))
      .subscribe({
        next: (data) => {
          if (this.selectedPlayer === currentPlayer) {
            const rowIndex = data.findIndex((row, index) =>
              index > 0 &&
              row[0] === formattedDate &&
              row[1] === currentPlayer
            );

            if (rowIndex > 0) {
              this.attendanceStatus = data[rowIndex][2] as 'Ja' | 'Nee' | 'Misschien';
            } else {
              this.attendanceStatus = null;
            }
            this.errorMessage = null;
          }
        },
        error: (err) => {
          console.error(`Error fetching attendance status for ${currentPlayer}:`, err);
          if (this.selectedPlayer === currentPlayer) {
            this.attendanceStatus = null;
            this.snackBar.open('Fout bij ophalen aanwezigheid status.', 'Sluiten', { duration: 5000, panelClass: ['snackbar-error'] });
          }
        }
      });
  }

  setAttendance(status: 'Ja' | 'Nee' | 'Misschien'): void {
    this.playerSelectError = null;
    if (!this.selectedPlayer || !this.nextGameDate || this.isLoadingStatus) {
      if (!this.selectedPlayer || !this.nextGameDate) {
        this.playerSelectError = 'Selecteer eerst een speler.';
      }
      return;
    }

    this.isLoadingStatus = true;
    const formattedDate = this.formatDate(this.nextGameDate);
    const currentPlayer = this.selectedPlayer;
    const rowData = [formattedDate, currentPlayer, status];

    this.googleSheetsService.getSheetData(this.SHEET_NAME)
      .subscribe({
        next: (data) => {
          if (this.selectedPlayer !== currentPlayer) {
            this.isLoadingStatus = false;
            return;
          }

          const rowIndex = data.findIndex((row, index) =>
            index > 0 &&
            row[0] === formattedDate &&
            row[1] === currentPlayer
          );

          let operation: Observable<any>;
          if (rowIndex > 0) {
            const sheetRowIndex = rowIndex + 1;
            console.log(`Updating row ${sheetRowIndex} for ${currentPlayer} on ${formattedDate}`);
            operation = this.googleSheetsService.updateSheetRow(this.SHEET_NAME, sheetRowIndex, rowData);
          } else {
            console.log(`Appending row for ${currentPlayer} on ${formattedDate}`);
            operation = this.googleSheetsService.appendSheetRow(this.SHEET_NAME, rowData);
          }

          operation.pipe(finalize(() => this.isLoadingStatus = false)).subscribe({
            next: (response) => {
              console.log('Attendance saved:', response);
              if (this.selectedPlayer === currentPlayer) {
                this.attendanceStatus = status;
                this.snackBar.open(`Aanwezigheid (${status}) voor ${currentPlayer} opgeslagen!`, 'Ok', { duration: 3000 });
              }
              this.loadAttendanceList(); // Refresh de lijst na opslaan
            },
            error: (err) => {
              console.error('Error saving attendance:', err);
              const message = (err instanceof Error) ? err.message : 'Fout bij opslaan aanwezigheid.';
              this.snackBar.open(message, 'Sluiten', { duration: 5000, panelClass: ['snackbar-error'] });
            }
          });
        },
        error: (err) => {
          console.error('Error fetching sheet data before saving:', err);
          const message = (err instanceof Error) ? err.message : 'Kon bestaande data niet controleren, opslaan mislukt.';
          this.snackBar.open(message, 'Sluiten', { duration: 5000, panelClass: ['snackbar-error'] });
          this.isLoadingStatus = false;
        }
      });
  }

  requestPushPermission() {
    this.pushPermissionError = null;
    this.pushPermissionLoading = true;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      this.showPushError('Push-notificaties worden niet ondersteund in deze browser.');
      this.pushPermissionLoading = false;
      return;
    }
    navigator.serviceWorker.ready.then(registration => {
      // Voeg een timeout toe voor het geval de gebruiker niet reageert
      let permissionHandled = false;
      const timeout = setTimeout(() => {
        if (!permissionHandled) {
          this.pushPermissionLoading = false;
          this.showPushError('Geen reactie op push-melding. Probeer het opnieuw.');
        }
      }, 15000); // 15 seconden
      Promise.resolve(Notification.requestPermission())
        .then(permission => {
          permissionHandled = true;
          clearTimeout(timeout);
          if (permission !== 'granted') {
            this.showPushError('Toestemming geweigerd.');
            this.pushPermissionLoading = false;
            return;
          }
          // Haal VAPID public key uit environment
          const vapidPublicKey = environment.vapidPublicKey;
          if (!vapidPublicKey) {
            this.showPushError('VAPID public key ontbreekt in de environment.');
            this.pushPermissionLoading = false;
            return;
          }
          const convertedVapidKey = this.urlBase64ToUint8Array(vapidPublicKey);
          registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
          }).then(subscription => {
            // Subscription opslaan in Google Sheets
            this.savePushSubscription(subscription);
          }).catch(err => {
            this.showPushError('Kon geen push subscription aanmaken: ' + err);
            this.pushPermissionLoading = false;
          });
        })
        .catch(err => {
          permissionHandled = true;
          clearTimeout(timeout);
          this.pushPermissionLoading = false;
          this.showPushError('Fout bij aanvragen push-permissie: ' + err);
        });
    }).catch(err => {
      this.pushPermissionLoading = false;
      this.showPushError('Service worker niet gereed: ' + err);
    });
  }

  private savePushSubscription(subscription: PushSubscription) {
    if (!this.selectedPlayer) {
      this.showPushError('Geen speler geselecteerd.');
      this.pushPermissionLoading = false;
      return;
    }

    this.playerService.updatePlayerPushSubscription(
      this.selectedPlayer,
      JSON.stringify(subscription),
      true
    ).subscribe({
      next: () => {
        this.pushPermissionGranted = true;
        this.pushPermissionLoading = false;
      },
      error: (err) => {
        this.showPushError('Fout bij opslaan subscription: ' + err);
        this.pushPermissionLoading = false;
      }
    });
  }

  private showPushError(message: string) {
    this.pushPermissionError = message;
    this.snackBar.open(message, 'Sluiten', { duration: 5000, panelClass: ['snackbar-error'] });
    // Optioneel: direct resetten zodat de error niet in de UI blijft hangen
    setTimeout(() => { this.pushPermissionError = null; }, 0);
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
