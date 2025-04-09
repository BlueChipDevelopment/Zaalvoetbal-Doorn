import { Component, OnInit } from '@angular/core';
import { LeaderboardService } from '../../services/leaderboard.service';
import { map } from 'rxjs/operators';
import { TitleCasePipe } from '@angular/common';

@Component({
  selector: 'app-extra-leaderboard',
  templateUrl: './extra-leaderboard.component.html',
  styleUrls: ['./extra-leaderboard.component.scss']
})
export class ExtraLeaderboardComponent implements OnInit {
  leaderboard: any[] = [];

  constructor(private titleCasePipe: TitleCasePipe, private leaderboardService: LeaderboardService) {}

  ngOnInit(): void {
    this.loadExtraLeaderboard();
  }

  private loadExtraLeaderboard(): void {
    this.leaderboardService.getExtraLeaderboard().pipe(
      map(matches => {
        const playerStats: { [player: string]: { gamesPlayed: number; totalPoints: number; wins: number; losses: number; ties: number; gameHistory?: { result: number; date: string }[] } } = {};

        matches.forEach(match => {
          const teamWhitePlayers = match.teamWhitePlayers.split(',').filter((player: string) => player.trim() !== 'Team Wit');
          const teamRedPlayers = match.teamRedPlayers.split(',').filter((player: string) => player.trim() !== 'Team Rood');

          // Update stats for Team White players
          teamWhitePlayers.forEach((player: string) => {
            const normalizedPlayer = player.trim().toLowerCase();
            if (!playerStats[normalizedPlayer]) {
              playerStats[normalizedPlayer] = { gamesPlayed: 0, totalPoints: 0, wins: 0, losses: 0, ties: 0, gameHistory: [] };
            }
            playerStats[normalizedPlayer].gamesPlayed++;
            playerStats[normalizedPlayer].totalPoints += match.teamWhiteGoals > match.teamRedGoals ? 3 : match.teamWhiteGoals === match.teamRedGoals ? 1 : 0;
            if (match.teamWhiteGoals > match.teamRedGoals) {
              playerStats[normalizedPlayer].wins++;
            } else if (match.teamWhiteGoals < match.teamRedGoals) {
              playerStats[normalizedPlayer].losses++;
            } else {
              playerStats[normalizedPlayer].ties++;
            }
            playerStats[normalizedPlayer].gameHistory?.push({ result: match.teamWhiteGoals > match.teamRedGoals ? 3 : match.teamWhiteGoals === match.teamRedGoals ? 1 : 0, date: match.date });
          });

          // Update stats for Team Red players
          teamRedPlayers.forEach((player: string) => {
            const normalizedPlayer = player.trim().toLowerCase();
            if (!playerStats[normalizedPlayer]) {
              playerStats[normalizedPlayer] = { gamesPlayed: 0, totalPoints: 0, wins: 0, losses: 0, ties: 0, gameHistory: [] };
            }
            playerStats[normalizedPlayer].gamesPlayed++;
            playerStats[normalizedPlayer].totalPoints += match.teamRedGoals > match.teamWhiteGoals ? 3 : match.teamRedGoals === match.teamWhiteGoals ? 1 : 0;
            if (match.teamRedGoals > match.teamWhiteGoals) {
              playerStats[normalizedPlayer].wins++;
            } else if (match.teamRedGoals < match.teamWhiteGoals) {
              playerStats[normalizedPlayer].losses++;
            } else {
              playerStats[normalizedPlayer].ties++;
            }
            playerStats[normalizedPlayer].gameHistory?.push({ result: match.teamRedGoals > match.teamWhiteGoals ? 3 : match.teamRedGoals === match.teamWhiteGoals ? 1 : 0, date: match.date });
          });
        });

        // Convert playerStats object to an array for display
        return Object.entries(playerStats).map(([player, stats]) => ({
          player: this.titleCasePipe.transform(player),
          gamesPlayed: stats.gamesPlayed,
          totalPoints: stats.totalPoints,
          wins: stats.wins,
          losses: stats.losses,
          ties: stats.ties,
          winRatio: stats.gamesPlayed > 0 ? (stats.wins / stats.gamesPlayed) * 100 : 0,
          gameHistory: stats.gameHistory || []
        })).sort((a, b) => b.totalPoints - a.totalPoints);
      })
    ).subscribe(leaderboard => {
      this.leaderboard = leaderboard;
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
}