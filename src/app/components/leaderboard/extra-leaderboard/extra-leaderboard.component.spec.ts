import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExtraLeaderboardComponent } from './extra-leaderboard.component';

describe('ExtraLeaderboardComponent', () => {
  let component: ExtraLeaderboardComponent;
  let fixture: ComponentFixture<ExtraLeaderboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExtraLeaderboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExtraLeaderboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
