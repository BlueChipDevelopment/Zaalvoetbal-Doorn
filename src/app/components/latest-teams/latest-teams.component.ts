import { Component, OnInit } from '@angular/core';
import { NextMatchService, NextMatchInfo } from '../../services/next-match.service';
import { GameStatisticsService } from '../../services/game.statistics.service';
import { PlayerCardComponent } from '../player-card/player-card.component';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Player } from '../../interfaces/IPlayer';

@Component({
  selector: 'app-latest-teams',
  templateUrl: './latest-teams.component.html',
  standalone: true,
  styleUrls: ['./latest-teams.component.scss'],
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatButtonModule,
    PlayerCardComponent
  ]
})
export class LatestTeamsComponent implements OnInit {
  teams: { teamWhite: Player[]; teamRed: Player[] } | null = null;
  orderedTeams: { key: string, value: Player[] }[] = [];
  loading = true;
  error: string | null = null;
  latestTeamsUrl = window.location.origin + '/opstelling';
  nextMatchInfo: NextMatchInfo | null = null;
  revealTime: Date | null = null;
  countdown: string | null = null;

  constructor(
    private nextMatchService: NextMatchService,
    private gameStatisticsService: GameStatisticsService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.nextMatchService.getNextMatchInfo().subscribe({
      next: (info) => {
        this.nextMatchInfo = info;
        if (info && info.wedstrijd && info.wedstrijd.teamWit && info.wedstrijd.teamRood) {
          // Opstelling is bekend
          this.loadPlayerCards(info);
        } else {
          // Opstelling nog niet bekend, bereken reveal time
          this.setCountdown(info);
          this.loading = false;
        }
      },
      error: () => {
        this.error = 'Fout bij laden van wedstrijdinformatie.';
        this.loading = false;
      }
    });
  }

  private loadPlayerCards(info: NextMatchInfo) {
    this.gameStatisticsService.getFullPlayerStats().subscribe({
      next: (playerStats) => {
        const teamWhite = this.parsePlayers(info.wedstrijd.teamWit, playerStats);
        const teamRed = this.parsePlayers(info.wedstrijd.teamRood, playerStats);
        this.teams = { teamWhite, teamRed };
        this.orderedTeams = [
          { key: 'teamWhite', value: teamWhite },
          { key: 'teamRed', value: teamRed }
        ];
        this.loading = false;
      },
      error: () => {
        this.error = 'Fout bij laden van spelers.';
        this.loading = false;
      }
    });
  }

  private parsePlayers(playerString: string, playerStats: any[]): any[] {
    return (playerString ?? '')
      .split(',')
      .map((player: string) => player.trim())
      .filter((trimmed: string) => !!trimmed)
      .map((trimmed: string) => {
        const match = playerStats.find((p: any) =>
          (p.name && p.name.trim().toLowerCase() === trimmed.toLowerCase()) ||
          (p.player && p.player.trim().toLowerCase() === trimmed.toLowerCase())
        );
        return match || { name: trimmed, position: '', rating: null };
      });
  }

  private setCountdown(info: NextMatchInfo | null) {
    if (!info || !info.parsedDate) return;
    // Reveal time = 3.5 uur voor wedstrijd
    const reveal = new Date(info.parsedDate.getTime());
    reveal.setHours(reveal.getHours() - 3, reveal.getMinutes() - 30);
    this.revealTime = reveal;
    this.updateCountdown();
    setInterval(() => this.updateCountdown(), 1000);
  }

  private updateCountdown() {
    if (!this.revealTime) return;
    const now = new Date();
    const diff = this.revealTime.getTime() - now.getTime();
    if (diff <= 0) {
      this.countdown = 'De opstelling wordt elk moment bekend gemaakt!';
      return;
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    this.countdown = `${hours}u ${minutes}m ${seconds}s tot de opstelling bekend wordt.`;
  }

  copyLatestTeamsLink() {
    navigator.clipboard.writeText(this.latestTeamsUrl);
    this.snackBar.open('Link naar de opstelling gekopieerd!', 'Sluiten', { duration: 2500, panelClass: ['snackbar-success'] });
  }

  getTeamRating(team: any[]): number {
    if (!team || !Array.isArray(team)) return 0;
    return team.reduce((sum, p) => sum + (p && p.rating ? p.rating : 0), 0);
  }
}
