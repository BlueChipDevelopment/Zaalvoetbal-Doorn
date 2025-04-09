import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule } from '@angular/material/dialog';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { TitleCasePipe } from '@angular/common';

import { AppComponent } from './app.component';
import { LeaderboardComponent } from './components/leaderboard/leaderboard.component';
import { TeamGeneratorComponent } from './components/team-generator/team-generator.component';
import { ChemistryModalComponent } from './components/leaderboard/chemistry-modal.component';
import { PincodeComponent } from './components/pincode/pincode.component';
import { AuthGuard } from './services/auth.guard';

@NgModule({
  declarations: [
    AppComponent,
    LeaderboardComponent,
    TeamGeneratorComponent,
    ChemistryModalComponent,
    PincodeComponent
  ],
  bootstrap: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    FormsModule,
    MatDividerModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatListModule,
    MatTooltipModule,
    MatMenuModule,
    MatDialogModule,
    RouterModule.forRoot([
      { 
        path: '', 
        component: TeamGeneratorComponent,
        canActivate: [AuthGuard]
      },
      { 
        path: 'leaderboard', 
        component: LeaderboardComponent,
        canActivate: [AuthGuard]
      },
      {
        path: 'pincode',
        component: PincodeComponent
      },
      // Redirect to PIN code screen for any unknown routes
      {
        path: '**',
        redirectTo: 'pincode'
      }
    ])
  ],
  providers: [provideHttpClient(withInterceptorsFromDi()), TitleCasePipe, AuthGuard]
})
export class AppModule {}

/*
Copyright Google LLC. All Rights Reserved.
Use of this source code is governed by an MIT-style license that
can be found in the LICENSE file at https://angular.io/license
*/
