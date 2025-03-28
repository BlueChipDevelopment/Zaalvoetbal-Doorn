import { Component, OnInit } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { Player } from '../../interfaces/IPlayer';
import { Positions } from '../../enums/positions.enum';
import { Team, Teams } from '../../interfaces/ITeam';
import { TeamGenerateService } from '../../services/team-generate.service';
import { GoogleSheetsService } from '../../services/google-sheets-service';
import { map, catchError, finalize } from 'rxjs/operators';
import { of, ReplaySubject } from 'rxjs';

@Component({
  selector: 'app-team-generator',
  templateUrl: './team-generator.component.html',
  styleUrls: ['./team-generator.component.css']
})
export class TeamGeneratorComponent implements OnInit {
  private mockPlayerList: Player[] = new Array<Player>();
  private loadingSubject = new ReplaySubject<boolean>(1);
  loading$ = this.loadingSubject.asObservable();

  protected isFirst: boolean = true;
  protected isGenerated: boolean = false;
  protected positions: string[] = Object.values(Positions);
  protected ratings: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  protected numOfPlayers: number = 0;
  protected teams: Teams = {} as Teams;
  protected teamsAlternate: Teams = {} as Teams;
  protected hidePlayerRatings: boolean = false;
  protected errorMessage: string | null = null;

  protected playerForms: FormGroup = new FormGroup({
    players: new FormArray<FormGroup>([]),
  });

  constructor(
    private teamGenerateService: TeamGenerateService,
    private googleSheetsService: GoogleSheetsService
  ) {}

  ngOnInit(): void {}

  protected getAsFormArray(formArray: any): FormArray {
    return formArray as FormArray;
  }

  protected getAsFormGroup(fromGroup: any): FormGroup {
    return fromGroup as FormGroup;
  }

  protected async generateTeams(): Promise<void> {
    let isAllValid = true;
    for (let playerForm of (this.playerForms.controls['players'] as FormArray).controls) {
      if (!playerForm.valid) {
        playerForm.markAllAsTouched();
        isAllValid = false;
      }
    }

    if (isAllValid) {
      this.isGenerated = true;
      
      this.teams = await this.teamGenerateService.generate(
        this.playerForms.controls['players'] as FormArray
      );

      this.teamsAlternate = await this.teamGenerateService.generate(
        this.playerForms.controls['players'] as FormArray
      );

      while (
        ([...this.teams.TeamA.squad].sort().join(",") === [...this.teamsAlternate.TeamA.squad].sort().join(",")) ||
        ([...this.teams.TeamA.squad].sort().join(",") === [...this.teamsAlternate.TeamB.squad].sort().join(","))
      ) {
        this.teamsAlternate = await this.teamGenerateService.generate(
          this.playerForms.controls['players'] as FormArray
        );
      }

      setTimeout(() => {
        let resultsHeight = document.querySelector<HTMLElement>(".results")?.offsetHeight;
        let generateButtonPosition = document.querySelector<HTMLElement>("#generate")?.offsetTop;
        window.scrollTo(0, ((generateButtonPosition?generateButtonPosition:0)-(resultsHeight?resultsHeight:0)/5));
      }, 200);
    }
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
      position: new FormControl<string | null>(Positions.MIDFIELDER.toString(), [Validators.required]),
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

  protected getTeamsAlternate(): string[] {
    return Object.keys(this.teamsAlternate);
  }

  protected getTeam(teamName: string): Team {
    return this.teams[teamName as keyof Teams] as Team;
  }

  protected getTeamAlternate(teamName: string): Team {
    return this.teamsAlternate[teamName as keyof Teams] as Team;
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
    const range = 'Bewerken!A3:D28';

    this.googleSheetsService
      .getDataFromRange(range)
      .pipe(
        map((response) => {
          const players: Player[] = [];
          if (response && response.values) {
            response.values.forEach((row: string[]) => {
              if (row[0] && row[2]?.toLowerCase() === 'ja') {
                const player: Player = {
                  name: row[0],
                  position: row[1] === 'Keeper' ? Positions.GOAL_KEEPER.toString() : Positions.MIDFIELDER.toString(),
                  rating: +row[3] || 5,
                  totalScore: 0,
                };
                players.push(player);
              }
            });
          }
          return players;
        }),
        catchError(error => {
          this.errorMessage = error.message;
          return of([]);
        }),
        finalize(() => {
          this.loadingSubject.next(false);
        })
      )
      .subscribe({
        next: (players: Player[]) => {
          this.mockPlayerList = players;
          if (players.length > 0) {
            this.GenerateFormFields();
          }
        }
      });
  }

  private GenerateFormFields() {
    this.numOfPlayers = this.mockPlayerList.length;
    let formArr = new FormArray<FormGroup>([]);
    for (let player of this.mockPlayerList) {
      let form = new FormGroup({
        name: new FormControl<string | null>(player.name, [Validators.required]),
        position: new FormControl<string | null>(player.position, [Validators.required]),
        rating: new FormControl<number | null>(player.rating, [Validators.required]),
      });
      formArr.push(form);
    }
    this.playerForms.controls['players'] = formArr;
    this.isFirst = false;
  }
}