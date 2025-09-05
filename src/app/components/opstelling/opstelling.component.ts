import { Component, OnInit } from '@angular/core';
import { NextMatchService, NextMatchInfo } from '../../services/next-match.service';
import { GameStatisticsService } from '../../services/game.statistics.service';
import { TeamGenerateService } from '../../services/team-generate.service';
import { PlayerCardComponent } from '../player-card/player-card.component';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar } from '@angular/material/snack-bar';
import { switchMap } from 'rxjs/operators';
import { Player } from '../../interfaces/IPlayer';
import { Team } from '../../interfaces/ITeam';

@Component({
  selector: 'app-opstelling',
  templateUrl: './opstelling.component.html',
  standalone: true,
  styleUrls: ['./opstelling.component.scss'],
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    PlayerCardComponent
  ]
})
export class OpstellingComponent implements OnInit {
  teams: { teamWhite: Player[]; teamRed: Player[] } | null = null;
  orderedTeams: { key: string, value: Player[] }[] = [];
  loading = true;
  error: string | null = null;
  opstellingUrl = window.location.origin + '/opstelling';
  nextMatchInfo: NextMatchInfo | null = null;
  showDetailedAnalysis = false;
  revealTime: Date | null = null;
  countdown: string | null = null;
  algorithmExplanation = '';
  showFullExplanation = false;

  constructor(
    private nextMatchService: NextMatchService,
    private gameStatisticsService: GameStatisticsService,
    private teamGenerateService: TeamGenerateService,
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
    this.gameStatisticsService.getCurrentSeason().pipe(
      switchMap(currentSeason => this.gameStatisticsService.getFullPlayerStats(currentSeason))
    ).subscribe({
      next: (playerStats) => {
        const teamWhite = this.parsePlayers(info.wedstrijd.teamWit, playerStats);
        const teamRed = this.parsePlayers(info.wedstrijd.teamRood, playerStats);
        this.teams = { teamWhite, teamRed };
        this.orderedTeams = [
          { key: 'teamWhite', value: teamWhite },
          { key: 'teamRed', value: teamRed }
        ];
        
        // Generate comprehensive team analysis
        this.generateComprehensiveAnalysis(teamWhite, teamRed);
        
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

  copyOpstellingLink() {
    navigator.clipboard.writeText(this.opstellingUrl);
    this.snackBar.open('Link naar de opstelling gekopieerd!', 'Sluiten', { duration: 2500, panelClass: ['snackbar-success'] });
  }

  getTeamRating(team: any[]): number {
    if (!team || !Array.isArray(team)) return 0;
    return team.reduce((sum, p) => sum + (p && p.rating ? p.rating : 0), 0);
  }

  getTeamPlayerNames(teamKey: string): string {
    const team = this.teams?.[teamKey as keyof typeof this.teams];
    if (!team || !Array.isArray(team)) return '';
    return team.map(p => p.name).join(', ');
  }

  getTeamRatingDifference(): string {
    if (!this.teams) return '0.0';
    const whiteRating = this.getTeamRating(this.teams.teamWhite);
    const redRating = this.getTeamRating(this.teams.teamRed);
    return Math.abs(whiteRating - redRating).toFixed(1);
  }

  getBalanceDescription(): string {
    const diff = parseFloat(this.getTeamRatingDifference());
    if (diff < 1.0) {
      return 'Extreem evenwichtige opstelling - spannende wedstrijd gegarandeerd! 🔥';
    } else if (diff < 2.0) {
      return 'Goede balans tussen de teams met kleine tactische verschillen. ⚽';
    } else if (diff < 3.0) {
      return 'Één team heeft een licht voordeel, maar vorm kan alles veranderen. 💪';
    } else {
      return 'Duidelijk verschil in sterkte - underdog kan verrassen! 🌟';
    }
  }

  getDetailedBalanceAnalysis(): string {
    const diff = parseFloat(this.getTeamRatingDifference());
    const whiteRating = this.getTeamRating(this.teams?.teamWhite || []);
    const redRating = this.getTeamRating(this.teams?.teamRed || []);
    
    let analysis = `Met een verschil van ${diff} punten tussen de teams, `;
    
    if (diff < 1.0) {
      analysis += 'is deze wedstrijd bijna perfecte gebalanceerd. Beide teams hebben vrijwel gelijke kansen op winst. Vorm op de dag en teamwork zullen het verschil maken.';
    } else if (diff < 2.0) {
      const strongerTeam = whiteRating > redRating ? 'Team Wit' : 'Team Rood';
      analysis += `heeft ${strongerTeam} een licht voordeel op papier. Dit kleine verschil kan echter gemakkelijk weggenomen worden door goede tactiek en inzet.`;
    } else if (diff < 3.0) {
      const strongerTeam = whiteRating > redRating ? 'Team Wit' : 'Team Rood';
      analysis += `is ${strongerTeam} de favoriet voor deze wedstrijd. Toch blijft voetbal onvoorspelbaar en kan de underdog met de juiste mentaliteit verrassen.`;
    } else {
      const strongerTeam = whiteRating > redRating ? 'Team Wit' : 'Team Rood';
      const weakerTeam = whiteRating > redRating ? 'Team Rood' : 'Team Wit';
      analysis += `heeft ${strongerTeam} een duidelijke voorsprong. ${weakerTeam} zal extra hard moeten werken, maar in zaalvoetbal kunnen individuele acties en geluk alles veranderen!`;
    }
    
    return analysis;
  }

  // Comprehensive team analysis methods
  private generateComprehensiveAnalysis(teamWhite: Player[], teamRed: Player[]): void {
    if (!teamWhite.length || !teamRed.length) {
      this.algorithmExplanation = '';
      return;
    }

    // Create mock Team objects for analysis
    const mockTeamWhite: Team = {
      name: 'Team Wit',
      squad: teamWhite,
      sumOfRatings: this.getTeamRating(teamWhite),
      totalScore: this.getTeamRating(teamWhite),
      shirtcolor: 'white',
      attack: this.calculateTeamAttack(teamWhite),
      defense: this.calculateTeamDefense(teamWhite),
      condition: this.calculateTeamCondition(teamWhite),
      chemistryScore: 0 // Chemistry not calculated for existing teams
    };

    const mockTeamRed: Team = {
      name: 'Team Rood', 
      squad: teamRed,
      sumOfRatings: this.getTeamRating(teamRed),
      totalScore: this.getTeamRating(teamRed),
      shirtcolor: 'red',
      attack: this.calculateTeamAttack(teamRed),
      defense: this.calculateTeamDefense(teamRed),
      condition: this.calculateTeamCondition(teamRed),
      chemistryScore: 0 // Chemistry not calculated for existing teams
    };

    // Analyze teams and generate explanation
    const whiteAnalysis = this.analyzeTeam(mockTeamWhite);
    const redAnalysis = this.analyzeTeam(mockTeamRed);
    const mainFactors = this.determineMainFactors(whiteAnalysis, redAnalysis);

    this.algorithmExplanation = this.generatePersonalizedExplanation(
      mockTeamWhite, mockTeamRed, whiteAnalysis, redAnalysis, mainFactors
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

  // Helper methods for Team object properties
  private calculateTeamAttack(players: Player[]): number {
    if (!players.length) return 0;
    // Simple calculation: average rating of attackers or all players if no specific attackers
    const attackers = players.filter(p => p.position && p.position.toLowerCase().includes('aanval'));
    const relevantPlayers = attackers.length > 0 ? attackers : players;
    return relevantPlayers.reduce((sum, p) => sum + (p.rating || 0), 0) / relevantPlayers.length;
  }

  private calculateTeamDefense(players: Player[]): number {
    if (!players.length) return 0;
    // Simple calculation: average rating of defenders/keepers or all players if no specific defenders
    const defenders = players.filter(p => p.position && 
      (p.position.toLowerCase().includes('verdedig') || 
       p.position.toLowerCase().includes('keeper') ||
       p.position.toLowerCase().includes('goal')));
    const relevantPlayers = defenders.length > 0 ? defenders : players;
    return relevantPlayers.reduce((sum, p) => sum + (p.rating || 0), 0) / relevantPlayers.length;
  }

  private calculateTeamCondition(players: Player[]): number {
    if (!players.length) return 0;
    // Simple calculation: average rating (could be more sophisticated with fitness data)
    return players.reduce((sum, p) => sum + (p.rating || 0), 0) / players.length;
  }
}
