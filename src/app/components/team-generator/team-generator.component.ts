import { Component, OnInit } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { Player } from '../../interfaces/IPlayer';
import { Positions } from '../../enums/positions.enum';
import { Team, Teams } from '../../interfaces/ITeam';
import { TeamGenerateService } from '../../services/team-generate.service';
import { finalize } from 'rxjs/operators';
import { ReplaySubject } from 'rxjs';

@Component({
  selector: 'app-team-generator',
  templateUrl: './team-generator.component.html',
  styleUrls: ['./team-generator.component.scss']
})
export class TeamGeneratorComponent implements OnInit {
  private mockPlayerList: Player[] = new Array<Player>();
  private loadingSubject = new ReplaySubject<boolean>(1);
  loading$ = this.loadingSubject.asObservable();

  public isFirst: boolean = true;
  public isGenerated = false;
  public isGenerating = false;
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

  constructor(
    private teamGenerateService: TeamGenerateService  ) {}

  ngOnInit(): void {}

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

  protected GetFutsalDoornPlayers(): void {
    this.loadingSubject.next(true);
    this.errorMessage = null;
    this.teamGenerateService.getPlayersWithCalculatedRatings()
      .pipe(
        finalize(() => this.loadingSubject.next(false))
      )
      .subscribe((players: any[]) => {
        // Filter alleen actieve spelers
        this.mockPlayerList = players.filter(p => p.actief);
        if (this.mockPlayerList.length > 0) {
          this.GenerateFormFields();
        }
      }, error => {
        this.errorMessage = error.message || 'Fout bij ophalen spelers.';
      });
  }

  private GenerateFormFields() {
    this.numOfPlayers = this.mockPlayerList.length;
    let formArr = new FormArray<FormGroup>([]);
    for (let player of this.mockPlayerList) {
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
}