import { Component, OnInit } from '@angular/core';
import { AttendanceService } from '../../services/attendance.service';
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
import { finalize, Observable, switchMap, of } from 'rxjs';
import { NextMatchService, NextMatchInfo } from '../../services/next-match.service';
import { NextMatchInfoComponent } from '../next-match-info/next-match-info.component';
import { PlayerCardComponent } from '../player-card/player-card.component';
import { Player } from '../../interfaces/IPlayer';
import { MatchAttendanceDetailsWithPlayerStatus, AttendanceStatus } from '../../interfaces/IAttendance';
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
  attendanceStatus: AttendanceStatus | null = null;
  attendanceList: { 
    speler: string; 
    status: AttendanceStatus; 
    playerObj?: Player;
    playerData?: Player;  // Voor template compatibility
    name: string;         // Voor template compatibility
  }[] = [];
  presentCount = 0;
  absentCount = 0;
  readonly LAST_PLAYER_KEY = 'lastSelectedPlayer';
  public errorMessage: string | null = null; // Algemene foutmeldingen (API, etc)
  public playerSelectError: string | null = null; // Alleen voor veldvalidatie spelerselectie

  pushPermissionGranted = false;
  pushPermissionLoading = false;
  pushPermissionError: string | null = null;


  constructor(
    private attendanceService: AttendanceService,
    private playerService: PlayerService,
    private snackBar: MatSnackBar,
    private nextMatchService: NextMatchService
  ) {}

  ngOnInit(): void {
    this.isLoadingPlayers = true;
    this.nextMatchService.getNextMatchInfo().subscribe({
      next: (info) => {
        this.nextMatchInfo = info;
        this.nextGameDate = info?.parsedDate || null;
        this.nextGameDateRaw = info?.date || null;
        this.errorMessage = null;
        
        // Eerst laden we de players, dan pas de attendance list
        this.loadPlayersAndThenAttendance();
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

  loadPlayersAndThenAttendance(): void {
    this.isLoadingPlayers = true;
    this.playerService.getPlayers()
      .pipe(
        finalize(() => this.isLoadingPlayers = false),
        switchMap(players => {
          // Zet de players data
          this.players = players;
          this.errorMessage = null;
          
          // Laad de laatst geselecteerde speler
          this.loadLastSelectedPlayer();
          
          // Nu laden we de attendance list met de juiste selectedPlayer
          if (!this.nextGameDate) {
            this.attendanceList = [];
            this.presentCount = 0;
            this.absentCount = 0;
            // Return empty observable dat direct completes
            return of(null);
          }
          
          const formattedDate = this.formatDate(this.nextGameDate);
          return this.attendanceService.getMatchAttendanceDetailsWithPlayerStatus(formattedDate, this.selectedPlayer || undefined);
        })
      )
      .subscribe({
        next: (details: MatchAttendanceDetailsWithPlayerStatus | null) => {
          if (!details) return; // Voor het geval er geen nextGameDate was
          
          // Combineer present en absent spelers voor de lijst
          this.attendanceList = [
            ...details.present.map((player: any) => ({
              speler: player.name,
              status: 'Ja' as 'Ja' | 'Nee',
              playerObj: player.playerData || this.createDefaultPlayer(player.name, player.position),
              playerData: player.playerData || this.createDefaultPlayer(player.name, player.position),
              name: player.name
            })),
            ...details.absent.map((player: any) => ({
              speler: player.name,
              status: 'Nee' as 'Ja' | 'Nee',
              playerObj: player.playerData || this.createDefaultPlayer(player.name, player.position),
              playerData: player.playerData || this.createDefaultPlayer(player.name, player.position),
              name: player.name
            }))
          ];
          
          this.presentCount = details.present.length;
          this.absentCount = details.absent.length;
          this.errorMessage = null;
          
          // Zet de attendance status direct vanuit de gecombineerde response
          if (this.selectedPlayer && details.playerStatus !== undefined) {
            this.attendanceStatus = details.playerStatus;
          }

        },
        error: (err) => {
          console.error('Error loading players or attendance:', err);
          this.errorMessage = 'Fout bij het laden van gegevens.';
          this.attendanceList = [];
          this.presentCount = 0;
          this.absentCount = 0;
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
    // Gebruik de gecombineerde methode die zowel de lijst als player status in één keer ophaalt
    this.attendanceService.getMatchAttendanceDetailsWithPlayerStatus(formattedDate, this.selectedPlayer || undefined).subscribe({
      next: (details: MatchAttendanceDetailsWithPlayerStatus) => {
        // Combineer present en absent spelers voor de lijst
        this.attendanceList = [
          ...details.present.map((player: any) => ({
            speler: player.name,
            status: 'Ja' as 'Ja' | 'Nee',
            playerObj: player.playerData || this.createDefaultPlayer(player.name, player.position),
            playerData: player.playerData || this.createDefaultPlayer(player.name, player.position),
            name: player.name
          })),
          ...details.absent.map((player: any) => ({
            speler: player.name,
            status: 'Nee' as 'Ja' | 'Nee',
            playerObj: player.playerData || this.createDefaultPlayer(player.name, player.position),
            playerData: player.playerData || this.createDefaultPlayer(player.name, player.position),
            name: player.name
          }))
        ];
        
        this.presentCount = details.present.length;
        this.absentCount = details.absent.length;
        this.errorMessage = null;
        
        // Zet de attendance status direct vanuit de gecombineerde response
        if (this.selectedPlayer && details.playerStatus !== undefined) {
          this.attendanceStatus = details.playerStatus;
        }

      },
      error: (err: any) => {
        this.attendanceList = [];
        this.presentCount = 0;
        this.absentCount = 0;
        this.errorMessage = 'Fout bij het laden van aanwezigheid.';
        console.error('Error loading attendance list:', err);
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
      // De attendance status wordt nu gecontroleerd in loadAttendanceList() na het laden van de data
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
      // Herlaad de attendance list met de nieuwe player status
      this.loadAttendanceList();
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
    
    // Eerst proberen de status uit de reeds geladen attendanceList te halen
    const existingEntry = this.attendanceList.find(entry => entry.speler === this.selectedPlayer);
    if (existingEntry) {
      this.attendanceStatus = existingEntry.status;
      return;
    }

    // Fallback: gebruik de gecombineerde methode voor consistentie
    this.isLoadingStatus = true;
    const formattedDate = this.formatDate(this.nextGameDate);
    const currentPlayer = this.selectedPlayer;

    this.attendanceService.getMatchAttendanceDetailsWithPlayerStatus(formattedDate, currentPlayer)
      .pipe(finalize(() => this.isLoadingStatus = false))
      .subscribe({
        next: (details) => {
          if (this.selectedPlayer === currentPlayer) {
            this.attendanceStatus = details.playerStatus || null;
            this.errorMessage = null;
          }
        },
        error: (err) => {
          console.error(`Error fetching attendance status for ${currentPlayer}:`, err);
          if (this.selectedPlayer === currentPlayer) {
            this.attendanceStatus = null;
            this.snackBar.open('Fout bij ophalen aanwezigheid status.', 'Sluiten', { 
              duration: 5000, 
              panelClass: ['snackbar-error'] 
            });
          }
        }
      });
  }

  setAttendance(status: AttendanceStatus): void {
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

    this.attendanceService.setAttendance({
      date: formattedDate,
      playerName: currentPlayer,
      status: status
    })
    .pipe(finalize(() => this.isLoadingStatus = false))
    .subscribe({
      next: (response) => {
        console.log('Attendance saved:', response);
        if (this.selectedPlayer === currentPlayer) {
          this.attendanceStatus = status;
          this.snackBar.open(`Aanwezigheid (${status}) voor ${currentPlayer} opgeslagen!`, 'Ok', { 
            duration: 3000 
          });
        }
        this.loadAttendanceList(); // Refresh de lijst na opslaan
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
  }

  requestPushPermission(): void {
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
            applicationServerKey: convertedVapidKey as BufferSource
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
    return new Uint8Array(outputArray.buffer);
  }

  private createDefaultPlayer(name: string, position?: string): Player {
    return {
      name: name,
      position: position || '',
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
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

}
