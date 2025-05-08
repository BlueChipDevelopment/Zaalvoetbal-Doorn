import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ScoreComponent } from './components/score/score.component';
import { LeaderboardComponent } from './components/leaderboard/leaderboard.component';
import { TeamGeneratorComponent } from './components/team-generator/team-generator.component';
import { AttendanceComponent } from './components/attendance/attendance.component';

const routes: Routes = [
  { path: 'klassement', component: LeaderboardComponent },
  { path: 'score', component: ScoreComponent },
  { path: 'team-generator', component: TeamGeneratorComponent },
  { path: 'aanwezigheid', component: AttendanceComponent }, // Gewijzigd van 'attendance' naar 'aanwezigheid'
  { path: '', redirectTo: '/klassement', pathMatch: 'full' }, // Default route
  { path: '**', redirectTo: '/klassement' } // Fallback route
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
