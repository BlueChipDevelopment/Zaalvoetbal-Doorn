import { Component, OnInit } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { Player } from '../../interfaces/IPlayer';
import { Positions } from '../../enums/positions.enum';
import { Team, Teams } from '../../interfaces/ITeam';
import { TeamGenerateService } from '../../services/team-generate.service';
import { GoogleSheetsService } from '../../services/google-sheets-service';
import { PlayerService } from '../../services/player.service';
import { PlayerSheetData } from '../../interfaces/IPlayerSheet';
import { finalize } from 'rxjs/operators';
import { ReplaySubject } from 'rxjs';
import { NextMatchService, NextMatchInfo } from '../../services/next-match.service';
import { NextMatchInfoComponent } from '../next-match-info/next-match-info.component';
import { AsyncPipe, CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PlayerCardComponent } from '../player-card/player-card.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconRegistry } from '@angular/material/icon';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-team-generator',
  standalone: true, 
  templateUrl: './team-generator.component.html',
  styleUrls: ['./team-generator.component.scss'],
  imports: [
    CommonModule,
    AsyncPipe,
    FormsModule,
    ReactiveFormsModule,
    NextMatchInfoComponent,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    MatDividerModule,
    PlayerCardComponent,
    DragDropModule,
  ],
})
export class TeamGeneratorComponent implements OnInit {
  private activePlayersList: Player[] = new Array<Player>();
  private loadingSubject = new ReplaySubject<boolean>(1);
  loading$ = this.loadingSubject.asObservable();

  public isFirst: boolean = true;
  public isGenerated = false;
  public isGenerating = false;
  public isTeamsSaved = false;

  public algorithmExplanation = '';
  
  protected positions: string[] = Object.values(Positions);
  protected ratings: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  protected numOfPlayers: number = 0;
  protected teams: Teams = {} as Teams;
  protected hidePlayerRatings: boolean = false;
  protected errorMessage: string | null = null;

  protected playerForms: FormGroup = new FormGroup({
    players: new FormArray<FormGroup>([]),
  });

  nextMatchInfo: NextMatchInfo | null = null;

  constructor(
    private teamGenerateService: TeamGenerateService,
    private nextMatchService: NextMatchService,
    private googleSheetsService: GoogleSheetsService,
    private playerService: PlayerService,
    private snackBar: MatSnackBar,
    private iconRegistry: MatIconRegistry,
    private sanitizer: DomSanitizer
  ) {
    // Register WhatsApp SVG icon
    this.iconRegistry.addSvgIcon(
      'whatsapp',
      this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/whatsapp.svg')
    );
  }

  ngOnInit(): void {
    this.loadingSubject.next(true);
    this.nextMatchService.getNextMatchInfo().subscribe(info => {
      this.nextMatchInfo = info;
      this.loadingSubject.next(false);
    });
  }

  protected getAsFormArray(formArray: any): FormArray {
    return formArray as FormArray;
  }

  protected getAsFormGroup(fromGroup: any): FormGroup {
    return fromGroup as FormGroup;
  }

  generateTeams() {
    this.isGenerating = true;
    this.teamGenerateService.cleanGeneratedTeams();

    // Use setTimeout to allow UI to update with spinner before heavy computation
    setTimeout(() => {
      const values = this.playerForms.value;
      if (!values.players || values.players.length === 0) {
        this.errorMessage = 'Please add players first.';
        this.isGenerating = false;
        return;
      }

      // Extract players directly from the form array to ensure only present players are included
      const selectedPlayers = this.getAsFormArray(this.playerForms.controls['players']).controls
        .map((control) => control.value)
        .filter((player: Player) => player && player.name && player.name.trim() !== '' && player.position && player.rating);

      console.log('Selected players for team generation:', selectedPlayers);

      // Generate teams with only selected players
      this.teamGenerateService.generateTeams(selectedPlayers);
      const generatedTeams = this.teamGenerateService.getGeneratedTeams();

      // Initialize teams object
      this.teams = {} as Teams;

      // Properly assign teams by index
      if (generatedTeams.length >= 2) {
        this.teams = {
          teamWhite: generatedTeams[0],
          teamRed: generatedTeams[1]
        };
      }

      this.isGenerated = true;

      // Generate explanation for the team balancing algorithm
      this.createAlgorithmExplanation();

      this.isGenerating = false;
    }, 100);
  }
  
  private createAlgorithmExplanation() {
    const teams = this.teamGenerateService.getGeneratedTeams();
    if (!teams || teams.length < 2) return;
    // Gebruik direct de ratings uit de Player-objecten in squad
    const team1Score = teams[0].squad && Array.isArray(teams[0].squad)
      ? teams[0].squad.reduce((sum, p) => sum + (p && p.rating ? p.rating : 0), 0).toFixed(2)
      : '0.00';
    const team2Score = teams[1].squad && Array.isArray(teams[1].squad)
      ? teams[1].squad.reduce((sum, p) => sum + (p && p.rating ? p.rating : 0), 0).toFixed(2)
      : '0.00';
    const scoreDiff = Math.abs(parseFloat(team1Score) - parseFloat(team2Score)).toFixed(2);
    this.algorithmExplanation = `De teams zijn in balans met een puntenverschil van slechts ${scoreDiff} punten.\nOns algoritme houdt rekening met spelersbeoordelingen, posities en historische chemiegegevens om gelijkwaardige teams te creëren.\nDe bijdrage van elke speler wordt gewogen op basis van hun prestaties in eerdere wedstrijden.`;
  }

  protected clean(): void {
    this.numOfPlayers = 0;
    this.playerForms = new FormGroup({
      players: new FormArray<FormGroup>([]),
    });

    this.isFirst = true;
    this.isGenerated = false;
  }

  protected addNewPlayer(): void {
    let form = new FormGroup({
      name: new FormControl<string | null>(null, [Validators.required]),
      position: new FormControl<string | null>(Positions.PLAYER.toString(), [Validators.required]),
      rating: new FormControl<number | null>(null, [Validators.required]),
    });
    (this.playerForms.controls['players'] as FormArray).push(form);
    this.numOfPlayers++;
  }

  protected deletePlayer(index: number): void {
    (this.playerForms.controls['players'] as FormArray).removeAt(index);
    this.numOfPlayers--;

    if (this.numOfPlayers < 1) this.isFirst = true;
  }

  protected getTeams(): string[] {
    return Object.keys(this.teams);
  }

  protected getTeam(teamName: string): Team {
    return this.teams[teamName as keyof Teams] as Team;
  }

  protected getPlayerByName(playerName: string): Player {
    return this.playerForms.controls['players'].value.find((player: Player) => {
      return player.name == playerName;
    });
  }

  protected createPlayerForms(): void {
    let formArr = new FormArray<FormGroup>([]);
    for (let i = 0; i < this.numOfPlayers; i++) {
      let form = new FormGroup({
        name: new FormControl<string | null>(null, [Validators.required]),
        position: new FormControl<string | null>(null, [Validators.required]),
        rating: new FormControl<number | null>(null, [Validators.required]),
      });
      formArr.push(form);
    }

    this.playerForms.controls['players'] = formArr;
    this.isFirst = false;
  }

  protected GetAanwezigSpelers(): void {
    this.loadingSubject.next(true);
    this.errorMessage = null;
    // Eerst alle ratings ophalen
    this.teamGenerateService.getFullPlayerStats().pipe(
      finalize(() => this.loadingSubject.next(false))
    ).subscribe({
      next: (playerStats: any[]) => {
        this.nextMatchService.getNextMatchInfo().subscribe({
          next: (matchInfo) => {
            if (!matchInfo) {
              this.snackBar.open('Geen aankomende wedstrijd gevonden.', 'Sluiten', { duration: 5000, panelClass: ['snackbar-error'] });
              return;
            }
            const dateString = matchInfo.parsedDate ? `${matchInfo.parsedDate.getFullYear()}-${(matchInfo.parsedDate.getMonth() + 1).toString().padStart(2, '0')}-${matchInfo.parsedDate.getDate().toString().padStart(2, '0')}` : matchInfo.date;
            this.googleSheetsService.getSheetData('Aanwezigheid').subscribe({
              next: (aanwezigheidData: any[][]) => {
                const aanwezigen = aanwezigheidData
                  .filter((row, idx) => idx > 0 && row[0] === dateString && row[2] === 'Ja')
                  .map(row => row[1]);
                if (aanwezigen.length === 0) {
                  this.snackBar.open('Geen aanwezige spelers gevonden voor de volgende wedstrijd.', 'Sluiten', { duration: 5000, panelClass: ['snackbar-error'] });
                  return;
                }
                let formArr = new FormArray<FormGroup>([]);
                for (let name of aanwezigen) {
                  const playerStat = playerStats.find((p: any) => p.name === name);
                  let form = new FormGroup({
                    name: new FormControl<string | null>(name, [Validators.required]),
                    position: new FormControl<string | null>(playerStat ? playerStat.position : Positions.PLAYER.toString(), [Validators.required]),
                    rating: new FormControl<number | null>(playerStat ? playerStat.rating : null, [Validators.required]),
                  });
                  formArr.push(form);
                }
                this.playerForms.controls['players'] = formArr;
                this.numOfPlayers = aanwezigen.length;
                this.isFirst = false;
                this.isGenerated = false;
                this.errorMessage = null;
              },
              error: (err) => {
                this.snackBar.open('Fout bij ophalen aanwezigheid: ' + (err.message || err), 'Sluiten', { duration: 5000, panelClass: ['snackbar-error'] });
              }
            });
          },
          error: (err) => {
            this.snackBar.open('Fout bij ophalen wedstrijden: ' + (err.message || err), 'Sluiten', { duration: 5000, panelClass: ['snackbar-error'] });
          }
        });
      },
      error: (err) => {
        this.snackBar.open('Fout bij ophalen spelersstatistieken: ' + (err.message || err), 'Sluiten', { duration: 5000, panelClass: ['snackbar-error'] });
      }
    });
  }
  

  protected GetAlleActieveSpelers(): void {
    this.loadingSubject.next(true);
    this.errorMessage = null;
    
    // Get statistics data to merge with player data
    this.teamGenerateService.getFullPlayerStats()
      .pipe(
        finalize(() => this.loadingSubject.next(false))
      )
      .subscribe({
        next: (players: any[]) => {
          // Filter alleen actieve spelers (statistics already include actief status from PlayerService)
          this.activePlayersList = players.filter(p => p.actief);
          if (this.activePlayersList.length > 0) {
            this.GenerateFormFields();
          }
        },
        error: (error) => {
          this.snackBar.open(error.message || 'Fout bij ophalen spelers.', 'Sluiten', { 
            duration: 5000, 
            panelClass: ['snackbar-error'] 
          });
        }
      });
  }

  private GenerateFormFields() {
    this.numOfPlayers = this.activePlayersList.length;
    let formArr = new FormArray<FormGroup>([]);
    for (let player of this.activePlayersList) {
      const playerName = (player as any).name || (player as any).player || '';
      // Normaliseer positie zodat deze overeenkomt met de enum waarden
      let playerPosition = (player as any).position || null;
      if (playerPosition) {
        // Zoek een match in Positions enum (case-insensitive)
        const match = this.positions.find(
          pos => pos.toLowerCase() === playerPosition.toLowerCase()
        );
        playerPosition = match || playerPosition;
      }
      let form = new FormGroup({
        name: new FormControl<string | null>(playerName, [Validators.required]),
        position: new FormControl<string | null>(playerPosition, [Validators.required]),
        rating: new FormControl<number | null>(player.rating, [Validators.required]),
      });
      formArr.push(form);
    }
    this.playerForms.controls['players'] = formArr;
    this.isFirst = false;
  }

  saveTeamsToSheet(): void {
    if (!this.nextMatchInfo || !this.teams.teamWhite || !this.teams.teamRed) {
      this.snackBar.open('Kan teams niet opslaan: ontbrekende gegevens.', 'Sluiten', { duration: 5000, panelClass: ['snackbar-error'] });
      return;
    }
    // Spinner niet tonen bij opslaan
    this.errorMessage = null;

    // Save to Wedstrijden sheet as before
    const teamWhiteNames = this.teams.teamWhite.squad.map(p => p.name).join(', ');
    const teamRedNames = this.teams.teamRed.squad.map(p => p.name).join(', ');
    let sheetRowIndex = this.nextMatchInfo.matchNumber ? Number(this.nextMatchInfo.matchNumber) + 1 : null;
    if (!sheetRowIndex) {
      this.snackBar.open('Kan rijnummer van de wedstrijd niet bepalen.', 'Sluiten', { duration: 5000, panelClass: ['snackbar-error'] });
      return;
    }
    const updateData = [
      {
        range: `Wedstrijden!C${sheetRowIndex}:D${sheetRowIndex}`,
        values: [[teamWhiteNames, teamRedNames]]
      }
    ];

    this.googleSheetsService.batchUpdateSheet(updateData)
      .subscribe({
        next: () => {
          this.isTeamsSaved = true;
          this.snackBar.open('Teams opgeslagen!', 'Sluiten', { duration: 3000, panelClass: ['snackbar-success'] });
          // Push notificatie sturen naar alle spelers met toestemming
          this.sendPushNotificationToAll(
            'De opstelling is bekend!',
            'Bekijk de teams voor de volgende wedstrijd.',
            window.location.origin + '/opstelling'
          );
        },
        error: (err) => {
          this.snackBar.open('Fout bij opslaan teams: ' + (err.message || err), 'Sluiten', { duration: 5000, panelClass: ['snackbar-error'] });
        }
      });
  }

  onPlayerDrop(event: CdkDragDrop<any[]>, targetTeamKey: string) {
    const sourceTeamKey = this.getTeams().find(teamKey => this.getTeam(teamKey).squad === event.previousContainer.data);
    const targetTeam = this.getTeam(targetTeamKey);
    const sourceTeam = this.getTeam(sourceTeamKey!);
    if (event.previousContainer === event.container) {
      // Zelfde team, sorteren
      const moved = targetTeam.squad.splice(event.previousIndex, 1)[0];
      targetTeam.squad.splice(event.currentIndex, 0, moved);
    } else {
      // Tussen teams verplaatsen
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
    // Optioneel: herbereken scores
    targetTeam.sumOfRatings = targetTeam.squad.reduce((sum, p) => sum + (p.rating || 0), 0);
    if (sourceTeamKey && sourceTeamKey !== targetTeamKey) {
      sourceTeam.sumOfRatings = sourceTeam.squad.reduce((sum, p) => sum + (p.rating || 0), 0);
    }
  }

  get connectedDropLists(): string[] {
    return this.getTeams().map(t => t + '-drop');
  }

  /**
   * Share the team composition via WhatsApp
   */
  shareTeamOnWhatsApp(teamKey: string): void {
    const team = this.getTeam(teamKey);
    if (!team) return;
    const playerNames = team.squad.map(p => p.name).join(', ');
    const message = `Team ${team.name} (${team.sumOfRatings.toFixed(2)} punten): %0A${playerNames}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  /**
   * Deel beide teams tegelijk via WhatsApp met visuele weergave (tekst)
   */
  shareAllTeamsOnWhatsApp(): void {
    if (!this.teams.teamWhite || !this.teams.teamRed) return;
    const teamToText = (team: Team) => {
      const players = team.squad.map((p, i) => `${i + 1}. ${p.name}`).join('%0A');
      return `*${team.name}* (Totaal: ${team.sumOfRatings.toFixed(2)})%0A${players}`;
    };
    const message =
      `${teamToText(this.teams.teamWhite)}%0A%0A${teamToText(this.teams.teamRed)}`;
    const url = `https://wa.me/?text=${message}`;
    window.open(url, '_blank');
  }

  /**
   * Maak een screenshot van het teamoverzicht en download als afbeelding
   */
  downloadTeamsScreenshot(): void {
    const resultsElement = document.querySelector('.results') as HTMLElement;
    if (!resultsElement) return;
    html2canvas(resultsElement, { backgroundColor: null }).then(canvas => {
      const link = document.createElement('a');
      link.download = `teams_${new Date().toISOString().slice(0,10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  /**
   * Stuur een push notificatie naar alle spelers met toestemming (via backend)
   */
  sendPushNotificationToAll(title: string, body: string, url: string) {
    fetch('https://europe-west1-zaalvoetbal-doorn-74a8c.cloudfunctions.net/sendPushToAll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, url })
    })
      .then(async res => {
        if (!res.ok) throw new Error(await res.text());
        this.snackBar.open('Push notificatie verstuurd!', 'Sluiten', { duration: 3000, panelClass: ['snackbar-success'] });
      })
      .catch(err => {
        this.snackBar.open('Fout bij versturen push notificatie: ' + err, 'Sluiten', { duration: 5000, panelClass: ['snackbar-error'] });
      });
  }

  trackByTeamKey(index: number, key: string): string {
    return key;
  }
}