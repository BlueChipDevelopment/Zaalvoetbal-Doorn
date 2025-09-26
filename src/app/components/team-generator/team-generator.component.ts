import { Component, OnInit } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { Player } from '../../interfaces/IPlayer';
import { Positions } from '../../enums/positions.enum';
import { Team, Teams } from '../../interfaces/ITeam';
import { TeamGenerateService } from '../../services/team-generate.service';
import { GoogleSheetsService } from '../../services/google-sheets-service';
import { AttendanceService } from '../../services/attendance.service';
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
import { WEDSTRIJD_RANGES } from '../../constants/sheet-columns';
import { PlayerCardComponent } from '../player-card/player-card.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconRegistry } from '@angular/material/icon';

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
  public showFullExplanation = false;
  
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
    private attendanceService: AttendanceService,
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
    
    const teamWhite = teams[0];
    const teamRed = teams[1];
    
    // Analyze team characteristics
    const whiteAnalysis = this.analyzeTeam(teamWhite);
    const redAnalysis = this.analyzeTeam(teamRed);
    
    // Determine main balancing factors
    const mainFactors = this.determineMainFactors(whiteAnalysis, redAnalysis);
    
    // Generate personalized explanation
    this.algorithmExplanation = this.generatePersonalizedExplanation(
      teamWhite, teamRed, whiteAnalysis, redAnalysis, mainFactors
    );
  }

  private analyzeTeam(team: Team) {
    const squad = team.squad;
    
    // Find players with exceptional form (last 5 games > 70% win rate)
    const playersInForm = squad.filter(player => {
      if (!player.gameHistory || player.gameHistory.length < 3) return false;
      const recentGames = player.gameHistory.slice(-5);
      const wins = recentGames.filter(game => game.result === 3).length;
      return (wins / recentGames.length) > 0.7;
    });
    
    // Find players with poor form (last 5 games < 30% win rate)
    const playersInPoorForm = squad.filter(player => {
      if (!player.gameHistory || player.gameHistory.length < 3) return false;
      const recentGames = player.gameHistory.slice(-5);
      const wins = recentGames.filter(game => game.result === 3).length;
      return (wins / recentGames.length) < 0.3;
    });
    
    // Find experienced players (>10 games played)
    const experiencedPlayers = squad.filter(player => 
      player.gamesPlayed && player.gamesPlayed > 10
    );
    
    // Find new players (<=3 games played)
    const newPlayers = squad.filter(player => 
      !player.gamesPlayed || player.gamesPlayed <= 3
    );
    
    // Find keepers
    const keepers = squad.filter(player => 
      player.position === 'Keeper' || player.position === 'GOAL_KEEPER'
    );
    
    // Find top rated player
    const topPlayer = squad.reduce((top, player) => 
      (player.rating || 0) > (top.rating || 0) ? player : top
    );
    
    // Calculate average rating
    const avgRating = squad.length > 0 
      ? squad.reduce((sum, p) => sum + (p.rating || 0), 0) / squad.length 
      : 0;
    
    return {
      playersInForm,
      playersInPoorForm,
      experiencedPlayers,
      newPlayers,
      keepers,
      topPlayer,
      avgRating,
      totalScore: team.totalScore || 0
    };
  }

  private determineMainFactors(whiteAnalysis: any, redAnalysis: any) {
    const factors = [];
    
    // Check if form is a major factor
    if (whiteAnalysis.playersInForm.length > 0 || redAnalysis.playersInForm.length > 0) {
      factors.push('form');
    }
    
    // Check if experience balancing is important
    const expDiff = Math.abs(whiteAnalysis.experiencedPlayers.length - redAnalysis.experiencedPlayers.length);
    if (expDiff <= 1 && (whiteAnalysis.experiencedPlayers.length > 0 || redAnalysis.experiencedPlayers.length > 0)) {
      factors.push('experience');
    }
    
    // Check if new player integration is happening
    if (whiteAnalysis.newPlayers.length > 0 || redAnalysis.newPlayers.length > 0) {
      factors.push('development');
    }
    
    // Check keeper situation
    if (whiteAnalysis.keepers.length > 0 && redAnalysis.keepers.length > 0) {
      factors.push('keepers');
    }
    
    // Always include balance as base factor
    factors.push('balance');
    
    return factors;
  }

  private generatePersonalizedExplanation(
    teamWhite: Team, 
    teamRed: Team, 
    whiteAnalysis: any, 
    redAnalysis: any, 
    factors: string[]
  ): string {
    let explanation = '';
    const scoreDiff = Math.abs(whiteAnalysis.totalScore - redAnalysis.totalScore).toFixed(1);
    
    // Team composition overview  
    explanation += `<p><strong>🏆 ${teamWhite.name}</strong>: ${teamWhite.squad.map(p => p.name).join(', ')}</p>`;
    explanation += `<p><strong>🔴 ${teamRed.name}</strong>: ${teamRed.squad.map(p => p.name).join(', ')}</p><br>`;
    
    // Form analysis
    if (factors.includes('form')) {
      if (whiteAnalysis.playersInForm.length > 0) {
        const formPlayers = whiteAnalysis.playersInForm.map((p: Player) => p.name).join(' en ');
        explanation += `<p>🔥 <strong>Team Wit</strong> heeft een voordeel door de uitstekende vorm van ${formPlayers}.</p>`;
      }
      if (redAnalysis.playersInForm.length > 0) {
        const formPlayers = redAnalysis.playersInForm.map((p: Player) => p.name).join(' en ');
        explanation += `<p>🔥 <strong>Team Rood</strong> heeft een voordeel door de uitstekende vorm van ${formPlayers}.</p>`;
      }
      
      // Mention players in poor form
      const allPoorForm = [...whiteAnalysis.playersInPoorForm, ...redAnalysis.playersInPoorForm];
      if (allPoorForm.length > 0) {
        const poorFormNames = allPoorForm.map((p: Player) => p.name).join(', ');
        explanation += `<p>⚠️ ${poorFormNames} ${allPoorForm.length === 1 ? 'heeft' : 'hebben'} recent mindere vorm - kans op comeback!</p>`;
      }
    }
    
    // Keeper analysis
    if (factors.includes('keepers')) {
      const whiteKeeper = whiteAnalysis.keepers[0];
      const redKeeper = redAnalysis.keepers[0];
      
      if (whiteKeeper && redKeeper) {
        explanation += `<p>🥅 Keeper-duel: <strong>${whiteKeeper.name}</strong> vs <strong>${redKeeper.name}</strong> - beide teams hebben sterke laatste verdediging.</p>`;
      } else if (whiteKeeper) {
        explanation += `<p>🥅 <strong>Team Wit</strong> heeft voordeel met keeper ${whiteKeeper.name}, Team Rood moet creatief verdedigen.</p>`;
      } else if (redKeeper) {
        explanation += `<p>🥅 <strong>Team Rood</strong> heeft voordeel met keeper ${redKeeper.name}, Team Wit moet creatief verdedigen.</p>`;
      }
    }
    
    // Experience vs Development
    if (factors.includes('development')) {
      const allNewPlayers = [...whiteAnalysis.newPlayers, ...redAnalysis.newPlayers];
      if (allNewPlayers.length > 0) {
        const newNames = allNewPlayers.map((p: Player) => p.name).join(', ');
        explanation += `<p>🌟 <strong>Ontwikkeling</strong>: ${newNames} ${allNewPlayers.length === 1 ? 'speelt' : 'spelen'} tussen ervaren spelers voor optimale groei.</p>`;
      }
    }
    
    if (factors.includes('experience')) {
      const whiteExp = whiteAnalysis.experiencedPlayers;
      const redExp = redAnalysis.experiencedPlayers;
      
      if (whiteExp.length > redExp.length) {
        explanation += `<p>🏆 <strong>Team Wit</strong> heeft meer ervaring met ${whiteExp.map((p: Player) => p.name).join(', ')}.</p>`;
      } else if (redExp.length > whiteExp.length) {
        explanation += `<p>🏆 <strong>Team Rood</strong> heeft meer ervaring met ${redExp.map((p: Player) => p.name).join(', ')}.</p>`;
      } else if (whiteExp.length > 0 && redExp.length > 0) {
        explanation += `<p>🏆 Ervaring is gelijk verdeeld: ${whiteExp.map((p: Player) => p.name).join(', ')} vs ${redExp.map((p: Player) => p.name).join(', ')}.</p>`;
      }
    }
    
    // Key player matchups
    if (whiteAnalysis.topPlayer && redAnalysis.topPlayer) {
      explanation += `<p>⭐ <strong>Sleutel-duel</strong>: ${whiteAnalysis.topPlayer.name} (${whiteAnalysis.topPlayer.rating}) vs ${redAnalysis.topPlayer.name} (${redAnalysis.topPlayer.rating}) - deze strijd kan de wedstrijd bepalen!</p>`;
    }
    
    // Final balance assessment
    explanation += `<p><strong>⚖️ Score-verschil</strong>: ${scoreDiff} punten - `;
    if (parseFloat(scoreDiff) < 1.0) {
      explanation += 'extreem spannende wedstrijd verwacht!';
    } else if (parseFloat(scoreDiff) < 2.0) {
      explanation += 'evenwichtige wedstrijd met kleine voordelen.';
    } else {
      explanation += 'één team heeft voordeel, maar vorm kan alles veranderen!';
    }
    explanation += '</p>';
    
    return explanation;
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
    
    // Eerst alle ratings ophalen (huidige seizoen)
    this.teamGenerateService.getCurrentSeasonPlayerStats().pipe(
      finalize(() => this.loadingSubject.next(false))
    ).subscribe({
      next: (playerStats: any[]) => {
        this.nextMatchService.getNextMatchInfo().subscribe({
          next: (matchInfo) => {
            if (!matchInfo) {
              this.snackBar.open('Geen aankomende wedstrijd gevonden.', 'Sluiten', { duration: 5000, panelClass: ['futsal-notification', 'futsal-notification-error'] });
              return;
            }
            
            const dateString = matchInfo.parsedDate 
              ? this.attendanceService.formatDate(matchInfo.parsedDate)
              : matchInfo.date;
            
            // Gebruik AttendanceService in plaats van direct Google Sheets
            this.attendanceService.getPresentPlayers(dateString).subscribe({
              next: (presentPlayers) => {
                if (presentPlayers.length === 0) {
                  this.snackBar.open('Geen aanwezige spelers gevonden voor de volgende wedstrijd.', 'Sluiten', { duration: 5000, panelClass: ['futsal-notification', 'futsal-notification-error'] });
                  return;
                }
                
                let formArr = new FormArray<FormGroup>([]);
                for (let player of presentPlayers) {
                  const playerStat = playerStats.find((p: any) => p.name === player.name);
                  let form = new FormGroup({
                    name: new FormControl<string | null>(player.name, [Validators.required]),
                    position: new FormControl<string | null>(playerStat ? playerStat.position : player.position || Positions.PLAYER.toString(), [Validators.required]),
                    rating: new FormControl<number | null>(playerStat ? playerStat.rating : null, [Validators.required]),
                  });
                  formArr.push(form);
                }
                
                this.playerForms.controls['players'] = formArr;
                this.numOfPlayers = presentPlayers.length;
                this.isFirst = false;
                this.isGenerated = false;
                this.errorMessage = null;
              },
              error: (err) => {
                this.snackBar.open('Fout bij ophalen aanwezigheid: ' + (err.message || err), 'Sluiten', { duration: 5000, panelClass: ['futsal-notification', 'futsal-notification-error'] });
              }
            });
          },
          error: (err) => {
            this.snackBar.open('Fout bij ophalen wedstrijden: ' + (err.message || err), 'Sluiten', { duration: 5000, panelClass: ['futsal-notification', 'futsal-notification-error'] });
          }
        });
      },
      error: (err) => {
        this.snackBar.open('Fout bij ophalen spelersstatistieken: ' + (err.message || err), 'Sluiten', { duration: 5000, panelClass: ['futsal-notification', 'futsal-notification-error'] });
      }
    });
  }
  

  protected GetAlleActieveSpelers(): void {
    this.loadingSubject.next(true);
    this.errorMessage = null;
    
    // Get statistics data to merge with player data (huidige seizoen)
    this.teamGenerateService.getCurrentSeasonPlayerStats()
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
            panelClass: ['futsal-notification', 'futsal-notification-error'] 
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
      this.snackBar.open('Kan teams niet opslaan: ontbrekende gegevens.', 'Sluiten', { duration: 5000, panelClass: ['futsal-notification', 'futsal-notification-error'] });
      return;
    }
    // Spinner niet tonen bij opslaan
    this.errorMessage = null;

    // Save to Wedstrijden sheet as before
    const teamWhiteNames = this.teams.teamWhite.squad.map(p => p.name).join(', ');
    const teamRedNames = this.teams.teamRed.squad.map(p => p.name).join(', ');
    
    // Gebruik de absoluteRowNumber uit de wedstrijd voor veilig opslaan
    let sheetRowIndex = this.nextMatchInfo.rowNumber;
    
    if (!sheetRowIndex) {
      // Fallback naar oude methode voor backwards compatibility
      sheetRowIndex = this.nextMatchInfo.matchNumber ? Number(this.nextMatchInfo.matchNumber) + 1 : undefined;
    }
    
    if (!sheetRowIndex) {
      this.snackBar.open('Kan rijnummer van de wedstrijd niet bepalen.', 'Sluiten', { duration: 5000, panelClass: ['futsal-notification', 'futsal-notification-error'] });
      return;
    }

    // Extra validatie: controleer seizoen en wedstrijdnummer
    const seizoen = this.nextMatchInfo.seizoen;
    const matchNumber = this.nextMatchInfo.matchNumber;
    
    console.log(`💾 Teams opslaan - Seizoen: ${seizoen || 'onbekend'}, Wedstrijd: ${matchNumber}, Rij: ${sheetRowIndex}`);

    const updateData = [
      {
        range: WEDSTRIJD_RANGES.TEAMS_WITH_GENERATIE(sheetRowIndex),
        values: [[teamWhiteNames, teamRedNames, 'Handmatig']]
      }
    ];

    this.googleSheetsService.batchUpdateSheet(updateData)
      .subscribe({
        next: () => {
          console.log(`✅ Teams succesvol opgeslagen voor ${seizoen || 'onbekend'} wedstrijd ${matchNumber}`);
          this.isTeamsSaved = true;
          this.snackBar.open('Teams opgeslagen!', 'Sluiten', { duration: 3000, panelClass: ['futsal-notification', 'futsal-notification-success'] });
          // Push notificatie sturen naar alle spelers met toestemming
          this.sendPushNotificationToAll(
            'De opstelling is bekend!',
            'Bekijk de teams voor de volgende wedstrijd.',
            window.location.origin + '/opstelling'
          );
        },
        error: (err) => {
          console.error(`❌ Fout bij opslaan teams voor ${seizoen || 'onbekend'} wedstrijd ${matchNumber}:`, err);
          this.snackBar.open('Fout bij opslaan teams: ' + (err.message || err), 'Sluiten', { duration: 5000, panelClass: ['futsal-notification', 'futsal-notification-error'] });
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
        this.snackBar.open('Push notificatie verstuurd!', 'Sluiten', { duration: 3000, panelClass: ['futsal-notification', 'futsal-notification-success'] });
      })
      .catch(err => {
        this.snackBar.open('Fout bij versturen push notificatie: ' + err, 'Sluiten', { duration: 5000, panelClass: ['futsal-notification', 'futsal-notification-error'] });
      });
  }

  trackByTeamKey(index: number, key: string): string {
    return key;
  }
}