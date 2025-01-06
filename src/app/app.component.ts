import { Component, OnInit } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
//import * as testPlayers from '../assets/futsal_doorn.json';
import { Player } from './interfaces/IPlayer';
import { Positions } from './enums/positions.enum';
import { Team, Teams } from './interfaces/ITeam';
import { TeamGenerateService } from './services/team-generate.service';
import { GoogleSheetsService } from './services/google-sheets-service';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  private mockPlayerList: Player[] = new Array<Player>();

  protected isFirst: boolean = true;
  protected isGenerated: boolean = false;
  protected positions: string[] = Object.values(Positions);
  protected ratings: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  protected numOfPlayers: number = 0;
  protected teams: Teams = {} as Teams;
  protected teamsAlternate: Teams = {} as Teams;
  protected hidePlayerRatings: boolean = false;

  protected playerForms: FormGroup = new FormGroup({
    players: new FormArray<FormGroup>([]),
  });

  constructor(
    private teamGenerateService: TeamGenerateService,
    private googleSheetsService: GoogleSheetsService
  ) {}

  ngOnInit(): void {
  }

  protected getAsFormArray(formArray: any): FormArray {
    return formArray as FormArray;
  }

  protected getAsFormGroup(fromGroup: any): FormGroup {
    return fromGroup as FormGroup;
  }

  protected generateTeams(): void {
    // Validatie van input
    let isAllValid = true;
    for (let playerForm of (this.playerForms.controls['players'] as FormArray)
      .controls) {
      if (!playerForm.valid) {
        playerForm.markAllAsTouched();
        isAllValid = false;
      }
    }

    if (isAllValid) {
      this.isGenerated = true;
      
      // Lees Spelers en Rating uit Google Sheets API
      //this.loadPlayersData();

      // Team genereatie
      this.teams = this.teamGenerateService.generate(
        this.playerForms.controls['players'] as FormArray
      );

      // Alternatieve team generatie
      this.teamsAlternate = this.teamGenerateService.generate(
        this.playerForms.controls['players'] as FormArray
      );

      // Wat is hier gaande?
      while (
        ([...this.teams.TeamA.squad].sort().join(",") === [...this.teamsAlternate.TeamA.squad].sort().join(",")) ||
        ([...this.teams.TeamA.squad].sort().join(",") === [...this.teamsAlternate.TeamB.squad].sort().join(","))
      ) {
        this.teamsAlternate = this.teamGenerateService.generate(
          this.playerForms.controls['players'] as FormArray
        );
      }

      // Scroll to the same position always to display results but also keep generate button in display
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
          rating: new FormControl<number | null>(null, [
            Validators.required,
          ]),
        });
        formArr.push(form);
      }

      this.playerForms.controls['players'] = formArr;
      this.isFirst = false;
  }

  protected GetFutsalDoornPlayers(): void {
    const range = 'Bewerken!A3:C28'; 
    this.googleSheetsService
      .getDataFromRange(range)
      .pipe(
        map((response) => {
          const players: Player[] = []; 

          if (response && response.values) {

            // Loop through response values (rows) one by one
            response.values.forEach((row: string[]) => {

              var naam = row[0]; // Column A: Naam
              var rating = +row[2]; // Column C: Rating

              var positie = Positions.MIDFIELDER; 
              if(row[1] === 'Keeper'){
                positie = Positions.GOAL_KEEPER;
              }

              // Map each row to a Player object
              const player: Player = {
                name: naam,          
                position: positie.toString(),          
                rating: rating,         
                totalScore: 0,  // Default value
              };

              // Add the player object to the result list
              players.push(player);
          });
        }

        return players;
      }))
      .subscribe({
        next: (players: Player[]) => {
          this.mockPlayerList = players;
          console.log('Players:', this.mockPlayerList);

          // Zet players in FormArray
          this.GenerateFormFields();
        },
        error: (e) => console.error('Error loading players:', e),
      });
  }

  private GenerateFormFields() {
    this.numOfPlayers = this.mockPlayerList.length;
    let formArr = new FormArray<FormGroup>([]);
    for (let player of this.mockPlayerList) {
      let form = new FormGroup({
        name: new FormControl<string | null>(player.name, [
          Validators.required,
        ]),
        position: new FormControl<string | null>(player.position, [
          Validators.required,
        ]),
        rating: new FormControl<number | null>(player.rating, [
          Validators.required,
        ]),
      });
      formArr.push(form);
    }
    this.playerForms.controls['players'] = formArr;
    this.isFirst = false;
  }
}