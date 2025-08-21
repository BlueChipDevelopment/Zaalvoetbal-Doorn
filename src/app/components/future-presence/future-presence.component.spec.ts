import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FuturePresenceComponent } from './future-presence.component';

describe('FuturePresenceComponent', () => {
  let component: FuturePresenceComponent;
  let fixture: ComponentFixture<FuturePresenceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FuturePresenceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FuturePresenceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
