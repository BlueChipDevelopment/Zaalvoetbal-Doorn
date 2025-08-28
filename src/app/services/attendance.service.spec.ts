import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { AttendanceService } from './attendance.service';
import { GoogleSheetsService } from './google-sheets-service';
import { PlayerService } from './player.service';
import { AttendanceStatus } from '../interfaces/IAttendance';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let mockGoogleSheetsService: jasmine.SpyObj<GoogleSheetsService>;
  let mockPlayerService: jasmine.SpyObj<PlayerService>;

  const mockAttendanceData = [
    ['Datum', 'Speler', 'Status'], // Header row
    ['2025-08-30', 'John Doe', 'Ja'],
    ['2025-08-30', 'Jane Smith', 'Nee'],
    ['2025-08-30', 'Charlie Brown', 'Nee'],
    ['2025-09-06', 'John Doe', 'Nee']
  ];

  const mockPlayers = [
    { name: 'John Doe', position: 'Speler', actief: true, pushPermission: false },
    { name: 'Jane Smith', position: 'Keeper', actief: true, pushPermission: true },
    { name: 'Charlie Brown', position: 'Speler', actief: true, pushPermission: false },
    { name: 'Alice Brown', position: 'Speler', actief: true, pushPermission: false }
  ];

  beforeEach(() => {
    const googleSheetsSpy = jasmine.createSpyObj('GoogleSheetsService', ['getSheetData', 'appendSheetRow', 'updateSheetRow']);
    const playerSpy = jasmine.createSpyObj('PlayerService', ['getActivePlayers']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AttendanceService,
        { provide: GoogleSheetsService, useValue: googleSheetsSpy },
        { provide: PlayerService, useValue: playerSpy }
      ]
    });

    service = TestBed.inject(AttendanceService);
    mockGoogleSheetsService = TestBed.inject(GoogleSheetsService) as jasmine.SpyObj<GoogleSheetsService>;
    mockPlayerService = TestBed.inject(PlayerService) as jasmine.SpyObj<PlayerService>;

    // Default mock responses
    mockGoogleSheetsService.getSheetData.and.returnValue(of(mockAttendanceData));
    mockPlayerService.getActivePlayers.and.returnValue(of(mockPlayers));
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should parse attendance data correctly', (done: DoneFn) => {
    service.getAttendanceRecords().subscribe(records => {
      expect(records.length).toBe(4);
      expect(records[0]).toEqual({
        date: '2025-08-30',
        playerName: 'John Doe',
        status: 'Ja' as AttendanceStatus,
        timestamp: undefined
      });
      done();
    });
  });

  it('should get attendance for specific date', (done: DoneFn) => {
    service.getAttendanceForDate('2025-08-30').subscribe(records => {
      expect(records.length).toBe(3);
      expect(records.every(r => r.date === '2025-08-30')).toBe(true);
      done();
    });
  });

  it('should get attendance for specific player', (done: DoneFn) => {
    service.getAttendanceForPlayer('John Doe').subscribe(records => {
      expect(records.length).toBe(2);
      expect(records.every(r => r.playerName === 'John Doe')).toBe(true);
      done();
    });
  });

  it('should get player attendance status', (done: DoneFn) => {
    service.getPlayerAttendanceStatus('John Doe', '2025-08-30').subscribe(status => {
      expect(status).toBe('Ja');
      done();
    });
  });

  it('should return null for non-existing attendance status', (done: DoneFn) => {
    service.getPlayerAttendanceStatus('Non-Existing Player', '2025-08-30').subscribe(status => {
      expect(status).toBe(null);
      done();
    });
  });

  it('should get match attendance details with correct categorization', (done: DoneFn) => {
    service.getMatchAttendanceDetails('2025-08-30').subscribe(details => {
      expect(details.date).toBe('2025-08-30');
      expect(details.present.length).toBe(1);
      expect(details.absent.length).toBe(2); // Now Charlie Brown is also absent
      expect(details.noResponse.length).toBe(1); // Alice Brown has no response
      
      expect(details.present[0].name).toBe('John Doe');
      expect(details.absent.find(p => p.name === 'Jane Smith')).toBeTruthy();
      expect(details.absent.find(p => p.name === 'Charlie Brown')).toBeTruthy();
      expect(details.noResponse[0].name).toBe('Alice Brown');
      
      done();
    });
  });

  it('should get present players for date', (done: DoneFn) => {
    service.getPresentPlayers('2025-08-30').subscribe(players => {
      expect(players.length).toBe(1);
      expect(players[0].name).toBe('John Doe');
      expect(players[0].status).toBe('Ja');
      done();
    });
  });

  it('should format date correctly', () => {
    const testDate = new Date('2025-08-30T10:00:00');
    const formatted = service.formatDate(testDate);
    expect(formatted).toBe('2025-08-30');
  });

  it('should set attendance for new player', (done: DoneFn) => {
    mockGoogleSheetsService.appendSheetRow.and.returnValue(of({ success: true }));

    service.setAttendance({
      date: '2025-09-13',
      playerName: 'New Player',
      status: 'Ja'
    }).subscribe(result => {
      expect(mockGoogleSheetsService.appendSheetRow).toHaveBeenCalledWith(
        'Aanwezigheid',
        ['2025-09-13', 'New Player', 'Ja']
      );
      done();
    });
  });

  it('should update existing attendance', (done: DoneFn) => {
    mockGoogleSheetsService.updateSheetRow.and.returnValue(of({ success: true }));

    service.setAttendance({
      date: '2025-08-30',
      playerName: 'John Doe',
      status: 'Nee'
    }).subscribe(result => {
      expect(mockGoogleSheetsService.updateSheetRow).toHaveBeenCalledWith(
        'Aanwezigheid',
        2, // Row index (first data row after header)
        ['2025-08-30', 'John Doe', 'Nee']
      );
      done();
    });
  });

  it('should handle empty sheet data', (done: DoneFn) => {
    mockGoogleSheetsService.getSheetData.and.returnValue(of([]));

    service.getAttendanceRecords().subscribe(records => {
      expect(records.length).toBe(0);
      done();
    });
  });

  it('should filter attendance records correctly', (done: DoneFn) => {
    service.getAttendanceRecords({ 
      status: 'Ja',
      futureOnly: false 
    }).subscribe(records => {
      expect(records.length).toBe(1);
      expect(records[0].status).toBe('Ja');
      expect(records[0].playerName).toBe('John Doe');
      done();
    });
  });
});
