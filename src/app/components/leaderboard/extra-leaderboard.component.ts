import { Component, OnInit, HostListener } from '@angular/core';
import { LeaderboardService } from '../../services/leaderboard.service';
import { map } from 'rxjs/operators';
import { TitleCasePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { ChemistryModalComponent } from './chemistry-modal.component';

@Component({
  selector: 'app-extra-leaderboard',
  templateUrl: './extra-leaderboard.component.html',
  styleUrls: ['./extra-leaderboard.component.scss']
})
export class ExtraLeaderboardComponent implements OnInit {
  leaderboard: any[] = [];
  isMobile = false;

  constructor(
    private titleCasePipe: TitleCasePipe,
    private leaderboardService: LeaderboardService,
    private dialog: MatDialog
  ) {}

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  ngOnInit(): void {
    this.checkScreenSize();
    this.loadExtraLeaderboard();
  }

  private checkScreenSize(): void {
    this.isMobile = window.innerWidth < 768;
  }

  private loadExtraLeaderboard(): void {
    this.leaderboardService.getExtraLeaderboard().pipe(
      map(matches => {
        matches = matches.filter(match => match.matchNumber !== "Wedstrijd #");

        const playerStats: { [player: string]: { gamesPlayed: number; totalPoints: number; wins: number; losses: number; ties: number; gameHistory?: { result: number; date: string; playerIds: string[] }[], zlatanPoints?: number, ventielPoints?: number } } = {};

        matches.forEach(match => {
          const teamWhitePlayers = (match.teamWhitePlayers || '').split(',').filter((player: string) => player.trim() !== 'Team Wit');
          const teamRedPlayers = (match.teamRedPlayers || '').split(',').filter((player: string) => player.trim() !== 'Team Rood');
          const allPlayers = [...teamWhitePlayers, ...teamRedPlayers].map((p: string) => p.trim().toLowerCase()).filter(Boolean);

          // Update stats for Team White players
          teamWhitePlayers.forEach((player: string) => {
            const normalizedPlayer = player.trim().toLowerCase();
            if (!normalizedPlayer) return; // Sla lege namen over
            if (!playerStats[normalizedPlayer]) {
              playerStats[normalizedPlayer] = { gamesPlayed: 0, totalPoints: 0, wins: 0, losses: 0, ties: 0, gameHistory: [], zlatanPoints: 0, ventielPoints: 0 };
            }
            playerStats[normalizedPlayer].gamesPlayed++;
            if (match.teamWhiteGoals > match.teamRedGoals) {
              playerStats[normalizedPlayer].wins++;
            } else if (match.teamWhiteGoals < match.teamRedGoals) {
              playerStats[normalizedPlayer].losses++;
            } else {
              playerStats[normalizedPlayer].ties++;
            }
            playerStats[normalizedPlayer].gameHistory?.push({
              result: match.teamWhiteGoals > match.teamRedGoals ? 3 : match.teamWhiteGoals === match.teamRedGoals ? 2 : 1,
              date: match.date,
              playerIds: allPlayers // voeg alle spelers toe aan deze game
            });
            if (match.zlatanPlayer && match.zlatanPlayer.trim().toLowerCase() === normalizedPlayer) {
              playerStats[normalizedPlayer].zlatanPoints = (playerStats[normalizedPlayer].zlatanPoints || 0) + 1;
            }
            if (match.ventielPlayer && match.ventielPlayer.trim()) {
              const normalizedVentielPlayer = match.ventielPlayer.trim().toLowerCase();
              if (normalizedVentielPlayer === normalizedPlayer) {
                playerStats[normalizedPlayer].ventielPoints = (playerStats[normalizedPlayer].ventielPoints || 0) + 1;
              }
            }
            playerStats[normalizedPlayer].totalPoints =
              (playerStats[normalizedPlayer].wins * 3) +
              (playerStats[normalizedPlayer].ties * 2) +
              (playerStats[normalizedPlayer].losses * 1) +
              (playerStats[normalizedPlayer].zlatanPoints || 0);
          });

          // Update stats for Team Red players
          teamRedPlayers.forEach((player: string) => {
            const normalizedPlayer = player.trim().toLowerCase();
            if (!normalizedPlayer) return; // Sla lege namen over
            if (!playerStats[normalizedPlayer]) {
              playerStats[normalizedPlayer] = { gamesPlayed: 0, totalPoints: 0, wins: 0, losses: 0, ties: 0, gameHistory: [], zlatanPoints: 0, ventielPoints: 0 };
            }
            playerStats[normalizedPlayer].gamesPlayed++;
            if (match.teamRedGoals > match.teamWhiteGoals) {
              playerStats[normalizedPlayer].wins++;
            } else if (match.teamRedGoals < match.teamWhiteGoals) {
              playerStats[normalizedPlayer].losses++;
            } else {
              playerStats[normalizedPlayer].ties++;
            }
            playerStats[normalizedPlayer].gameHistory?.push({
              result: match.teamRedGoals > match.teamWhiteGoals ? 3 : match.teamRedGoals === match.teamWhiteGoals ? 2 : 1,
              date: match.date,
              playerIds: allPlayers // voeg alle spelers toe aan deze game
            });
            if (match.zlatanPlayer && match.zlatanPlayer.trim().toLowerCase() === normalizedPlayer) {
              playerStats[normalizedPlayer].zlatanPoints = (playerStats[normalizedPlayer].zlatanPoints || 0) + 1;
            }
            if (match.ventielPlayer && match.ventielPlayer.trim()) {
              const normalizedVentielPlayer = match.ventielPlayer.trim().toLowerCase();
              if (normalizedVentielPlayer === normalizedPlayer) {
                playerStats[normalizedPlayer].ventielPoints = (playerStats[normalizedPlayer].ventielPoints || 0) + 1;
              }
            }
            playerStats[normalizedPlayer].totalPoints =
              (playerStats[normalizedPlayer].wins * 3) +
              (playerStats[normalizedPlayer].ties * 2) +
              (playerStats[normalizedPlayer].losses * 1) +
              (playerStats[normalizedPlayer].zlatanPoints || 0);
          });
        });

        // Bepaal het hoogste aantal punten
        const maxTotalPoints = Math.max(...Object.values(playerStats).map(stats => stats.totalPoints || 0), 1);

        // Convert playerStats object to an array for display and add rating
        return Object.entries(playerStats).map(([player, stats]) => {
          // Nieuwe rating formule: schaal 1-10, hoogste punten = 10
          let rating = Math.round((stats.totalPoints / (maxTotalPoints / 10)));
          rating = Math.max(1, Math.min(10, rating));
          return {
            player: this.titleCasePipe.transform(player),
            gamesPlayed: stats.gamesPlayed,
            totalPoints: stats.totalPoints,
            rating: rating,
            wins: stats.wins,
            losses: stats.losses,
            ties: stats.ties,
            winRatio: stats.gamesPlayed > 0 ? (stats.wins / stats.gamesPlayed) * 100 : 0,
            gameHistory: stats.gameHistory || [],
            zlatanPoints: stats.zlatanPoints || 0,
            ventielPoints: stats.ventielPoints || 0
          };
        }).sort((a, b) => b.totalPoints - a.totalPoints);
      })
    ).subscribe(leaderboard => {
      this.leaderboard = leaderboard;
      console.log('Final Leaderboard Data:', this.leaderboard);
    });
  }

  protected getLastFiveGames(player: any): { result: number; date: string }[] {
    if (!player.gameHistory || player.gameHistory.length === 0) {
      return [];
    }

    // Sort by date (most recent first) and take the last 5 games
    return [...player.gameHistory]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map(game => ({
        result: game.result, // Use the correct field for result
        date: game.date
      }));
  }

  protected openChemistryModal(player: any): void {
    this.dialog.open(ChemistryModalComponent, {
      width: '400px',
      data: {
        player: { ...player, name: player.player }, // voeg name toe
        bestTeammates: this.getBestAndWorstTeammates(player)
      }
    });
  }

  private getBestAndWorstTeammates(player: any): { best: any; worst: any } {
    // Verzamel chemistry-data per teammate
    if (!player || !player.gameHistory) {
      return {
        best: { name: 'No data', gamesPlayed: 0, gamesWon: 0, gamesTied: 0, gamesLost: 0, chemistryScore: 0 },
        worst: { name: 'No data', gamesPlayed: 0, gamesWon: 0, gamesTied: 0, gamesLost: 0, chemistryScore: 0 }
      };
    }
    const chemistry: { [teammate: string]: { gamesPlayed: number; gamesWon: number; gamesTied: number; gamesLost: number } } = {};
    // Loop door alle games van deze speler
    player.gameHistory.forEach((game: any) => {
      if (!game.playerIds) return;
      // game.playerIds bevat alle spelers in deze wedstrijd
      game.playerIds.forEach((teammateId: string) => {
        if (teammateId === player.player) return; // Zichzelf overslaan
        if (!chemistry[teammateId]) {
          chemistry[teammateId] = { gamesPlayed: 0, gamesWon: 0, gamesTied: 0, gamesLost: 0 };
        }
        chemistry[teammateId].gamesPlayed++;
        if (game.result === 3) chemistry[teammateId].gamesWon++;
        else if (game.result === 2) chemistry[teammateId].gamesTied++;
        else chemistry[teammateId].gamesLost++;
      });
    });
    // Maak teammate objects
    const teammates = Object.entries(chemistry)
      .map(([name, stats]) => ({
        name: this.titleCasePipe.transform(name),
        gamesPlayed: stats.gamesPlayed,
        gamesWon: stats.gamesWon,
        gamesTied: stats.gamesTied,
        gamesLost: stats.gamesLost,
        chemistryScore: stats.gamesPlayed > 0 ? stats.gamesWon / stats.gamesPlayed : 0
      }))
      .filter(t => t.gamesPlayed >= 3); // Alleen teammates met minimaal 3 gezamenlijke wedstrijden
    const sorted = teammates.sort((a, b) => b.chemistryScore - a.chemistryScore);
    return {
      best: sorted.length > 0 ? sorted[0] : { name: 'No data', gamesPlayed: 0, gamesWon: 0, gamesTied: 0, gamesLost: 0, chemistryScore: 0 },
      worst: sorted.length > 0 ? sorted[sorted.length - 1] : { name: 'No data', gamesPlayed: 0, gamesWon: 0, gamesTied: 0, gamesLost: 0, chemistryScore: 0 }
    };
  }
}