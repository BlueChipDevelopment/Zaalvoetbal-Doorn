import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ScoreComponent } from './components/score/score.component';
import { LeaderboardComponent } from './components/leaderboard/leaderboard.component';
import { TeamGeneratorComponent } from './components/team-generator/team-generator.component';
import { AttendanceComponent } from './components/attendance/attendance.component';
import { KalenderComponent } from './components/kalender/kalender.component';
import { WedstrijdenComponent } from './components/wedstrijden/wedstrijden.component';
import { OpstellingComponent } from './components/opstelling/opstelling.component';
import { AboutComponent } from './components/about/about.component';

const routes: Routes = [
  { path: 'klassement', component: LeaderboardComponent },
  { path: 'score', component: ScoreComponent },
  { path: 'team-generator', component: TeamGeneratorComponent },
  { path: 'aanwezigheid', component: AttendanceComponent },
  { path: 'kalender', component: KalenderComponent },
  { path: 'wedstrijden', component: WedstrijdenComponent },
  { path: 'opstelling', component: OpstellingComponent },
  { path: 'about', component: AboutComponent },
  { path: '', redirectTo: '/klassement', pathMatch: 'full' },
  { path: '**', redirectTo: '/klassement' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
