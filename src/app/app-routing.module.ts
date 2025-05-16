import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ScoreComponent } from './components/score/score.component';
import { LeaderboardComponent } from './components/leaderboard/leaderboard.component';
import { TeamGeneratorComponent } from './components/team-generator/team-generator.component';
import { AttendanceComponent } from './components/attendance/attendance.component';
import { WedstrijdenComponent } from './components/wedstrijden/wedstrijden.component';
import { LatestTeamsComponent } from './components/latest-teams/latest-teams.component';

const routes: Routes = [
  { path: 'klassement', component: LeaderboardComponent },
  { path: 'score', component: ScoreComponent },
  { path: 'team-generator', component: TeamGeneratorComponent },
  { path: 'aanwezigheid', component: AttendanceComponent },
  { path: 'wedstrijden', component: WedstrijdenComponent },
  { path: 'opstelling', component: LatestTeamsComponent },
  { path: '', redirectTo: '/klassement', pathMatch: 'full' },
  { path: '**', redirectTo: '/klassement' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
