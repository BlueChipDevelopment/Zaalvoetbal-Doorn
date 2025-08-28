import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { WedstrijdenService } from './wedstrijden.service';
import { GoogleSheetsService } from './google-sheets-service';

describe('WedstrijdenService', () => {
  let service: WedstrijdenService;
  let mockGoogleSheetsService: jasmine.SpyObj<GoogleSheetsService>;

  // Mock data that matches the expected Google Sheets format
  const mockWedstrijdenData = [
    ['ID', 'Datum', 'Team Wit', 'Team Rood', 'Score Wit', 'Score Rood', 'Zlatan', 'Ventiel'], // Header
    ['1', '15-09-2024', 'Team A', 'Team B', '3', '2', 'Player1', 'Player2'],
    ['2', '22-09-2024', 'Team C', 'Team D', '1', '4', 'Player3', 'Player4'],
    ['3', '29-09-2024', 'Team A', 'Team C', '', '', 'Player1', 'Player3'], // Future match
    ['4', '15-01-2025', 'Team B', 'Team D', '2', '1', 'Player2', 'Player4']
  ];

  beforeEach(() => {
    const googleSheetsSpy = jasmine.createSpyObj('GoogleSheetsService', ['getSheetData']);

    TestBed.configureTestingModule({
      providers: [
        WedstrijdenService,
        { provide: GoogleSheetsService, useValue: googleSheetsSpy }
      ]
    });

    service = TestBed.inject(WedstrijdenService);
    mockGoogleSheetsService = TestBed.inject(GoogleSheetsService) as jasmine.SpyObj<GoogleSheetsService>;
    
    // Default mock return
    mockGoogleSheetsService.getSheetData.and.returnValue(of(mockWedstrijdenData));
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get all wedstrijden', (done) => {
    service.getWedstrijden().subscribe(wedstrijden => {
      expect(wedstrijden).toBeTruthy();
      expect(wedstrijden.length).toBe(4);
      expect(wedstrijden[0].teamWit).toBe('Team A');
      expect(wedstrijden[0].scoreWit).toBe(3);
      done();
    });
  });

  it('should get only gespeelde wedstrijden', (done) => {
    service.getGespeeldeWedstrijden().subscribe(wedstrijden => {
      expect(wedstrijden).toBeTruthy();
      expect(wedstrijden.length).toBe(3); // Excluding the future match
      wedstrijden.forEach(w => {
        expect(w.scoreWit).not.toBeNull();
        expect(w.scoreRood).not.toBeNull();
      });
      done();
    });
  });

  it('should get only toekomstige wedstrijden', (done) => {
    service.getToekomstigeWedstrijden().subscribe(wedstrijden => {
      expect(wedstrijden).toBeTruthy();
      expect(wedstrijden.length).toBe(1); // Only the future match
      expect(wedstrijden[0].scoreWit).toBeNull();
      expect(wedstrijden[0].scoreRood).toBeNull();
      done();
    });
  });

  it('should get beschikbare seizoenen', (done) => {
    service.getBeschikbareSeizoen().subscribe(seizoenen => {
      expect(seizoenen).toBeTruthy();
      expect(seizoenen.length).toBeGreaterThan(0);
      expect(seizoenen[0]).toEqual(jasmine.objectContaining({
        seizoen: jasmine.any(String),
        aantalWedstrijden: jasmine.any(Number),
        aantalGespeeld: jasmine.any(Number)
      }));
      done();
    });
  });

  it('should filter wedstrijden by seizoen', (done) => {
    service.getWedstrijdenVoorSeizoen('2024-2025').subscribe(wedstrijden => {
      expect(wedstrijden).toBeTruthy();
      // All September 2024 and January 2025 matches should be in 2024-2025 season
      expect(wedstrijden.length).toBeGreaterThan(0);
      done();
    });
  });

  it('should handle empty data gracefully', (done) => {
    mockGoogleSheetsService.getSheetData.and.returnValue(of([]));
    
    service.getWedstrijden().subscribe(wedstrijden => {
      expect(wedstrijden).toEqual([]);
      done();
    });
  });

  it('should refresh cache', (done) => {
    // First call
    service.getWedstrijden().subscribe(() => {
      expect(mockGoogleSheetsService.getSheetData).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      service.getWedstrijden().subscribe(() => {
        expect(mockGoogleSheetsService.getSheetData).toHaveBeenCalledTimes(1);
        
        // Refresh cache should force new call
        service.refreshCache().subscribe(() => {
          expect(mockGoogleSheetsService.getSheetData).toHaveBeenCalledTimes(2);
          done();
        });
      });
    });
  });
});
