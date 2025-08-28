import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject, combineLatest } from 'rxjs';
import { map, tap, catchError, shareReplay, switchMap, finalize } from 'rxjs/operators';
import { GoogleSheetsService } from './google-sheets-service';
import { PlayerService } from './player.service';
import { 
  AttendanceRecord, 
  AttendanceStatus, 
  MatchAttendanceOverview, 
  MatchAttendanceDetails,
  AttendanceFilter,
  AttendanceUpdate,
  AttendancePlayerInfo
} from '../interfaces/IAttendance';
import { PlayerSheetData } from '../interfaces/IPlayerSheet';

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private readonly SHEET_NAME = 'Aanwezigheid';
  private attendanceCache$ = new BehaviorSubject<AttendanceRecord[] | null>(null);
  private cacheTimestamp = 0;
  private readonly CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache (shorter than players)

  constructor(
    private googleSheetsService: GoogleSheetsService,
    private playerService: PlayerService
  ) {}

  /**
   * Get all attendance records with optional filtering
   */
  getAttendanceRecords(filter?: AttendanceFilter): Observable<AttendanceRecord[]> {
    return this.getCachedAttendance().pipe(
      map(records => this.applyFilter(records, filter))
    );
  }

  /**
   * Get attendance records for a specific date
   */
  getAttendanceForDate(date: string): Observable<AttendanceRecord[]> {
    return this.getAttendanceRecords({ date });
  }

  /**
   * Get attendance records for a specific player
   */
  getAttendanceForPlayer(playerName: string): Observable<AttendanceRecord[]> {
    return this.getAttendanceRecords({ playerName });
  }

  /**
   * Get attendance overview for all matches
   */
  getMatchAttendanceOverviews(filter?: AttendanceFilter): Observable<MatchAttendanceOverview[]> {
    return this.getAttendanceRecords(filter).pipe(
      map(records => {
        const dateGroups = this.groupByDate(records);
        return Object.entries(dateGroups).map(([date, dateRecords]) => ({
          date,
          presentCount: dateRecords.filter(r => r.status === 'Ja').length,
          absentCount: dateRecords.filter(r => r.status === 'Nee').length,
          totalResponses: dateRecords.length
        })).sort((a, b) => a.date.localeCompare(b.date));
      })
    );
  }

  /**
   * Get detailed attendance information for a specific match
   */
  getMatchAttendanceDetails(date: string): Observable<MatchAttendanceDetails> {
    return combineLatest([
      this.getAttendanceForDate(date),
      this.playerService.getActivePlayers()
    ]).pipe(
      map(([attendanceRecords, allPlayers]) => {
        const attendanceMap = new Map<string, AttendanceRecord>();
        attendanceRecords.forEach(record => {
          attendanceMap.set(record.playerName, record);
        });

        const present: AttendancePlayerInfo[] = [];
        const absent: AttendancePlayerInfo[] = [];
        const noResponse: AttendancePlayerInfo[] = [];

        allPlayers.forEach((player: PlayerSheetData) => {
          const attendance = attendanceMap.get(player.name);
          const playerInfo: AttendancePlayerInfo = {
            name: player.name,
            position: player.position,
            status: attendance?.status,
            playerData: player
          };

          if (attendance) {
            switch (attendance.status) {
              case 'Ja':
                present.push(playerInfo);
                break;
              case 'Nee':
                absent.push(playerInfo);
                break;
            }
          } else {
            noResponse.push(playerInfo);
          }
        });

        // Sort all arrays by name
        const sortByName = (a: AttendancePlayerInfo, b: AttendancePlayerInfo) => 
          a.name.localeCompare(b.name);

        return {
          date,
          present: present.sort(sortByName),
          absent: absent.sort(sortByName),
          noResponse: noResponse.sort(sortByName)
        };
      })
    );
  }

  /**
   * Get attendance status for a specific player and date
   */
  getPlayerAttendanceStatus(playerName: string, date: string): Observable<AttendanceStatus | null> {
    return this.getAttendanceRecords({ playerName, date }).pipe(
      map(records => records.length > 0 ? records[0].status : null)
    );
  }

  /**
   * Get all players present for a specific date (useful for team generation)
   */
  getPresentPlayers(date: string): Observable<AttendancePlayerInfo[]> {
    return this.getMatchAttendanceDetails(date).pipe(
      map(details => details.present)
    );
  }

  /**
   * Set attendance status for a player on a specific date
   */
  setAttendance(update: AttendanceUpdate): Observable<any> {
    return this.getAttendanceRecords().pipe(
      switchMap(records => {
        const existingRecordIndex = records.findIndex(r => 
          r.date === update.date && r.playerName === update.playerName
        );

        const rowData = [update.date, update.playerName, update.status];

        let operation: Observable<any>;
        if (existingRecordIndex >= 0) {
          // Update existing record (index + 2 because of header row and 0-based indexing)
          const sheetRowIndex = existingRecordIndex + 2;
          operation = this.googleSheetsService.updateSheetRow(this.SHEET_NAME, sheetRowIndex, rowData);
        } else {
          // Append new record
          operation = this.googleSheetsService.appendSheetRow(this.SHEET_NAME, rowData);
        }

        return operation.pipe(
          tap(() => {
            // Update cache with new data
            const updatedRecords = [...records];
            const newRecord: AttendanceRecord = {
              date: update.date,
              playerName: update.playerName,
              status: update.status
            };

            if (existingRecordIndex >= 0) {
              updatedRecords[existingRecordIndex] = newRecord;
            } else {
              updatedRecords.push(newRecord);
            }

            this.attendanceCache$.next(updatedRecords);
          })
        );
      })
    );
  }

  /**
   * Get players who haven't responded for a specific date
   */
  getPlayersWithoutResponse(date: string): Observable<AttendancePlayerInfo[]> {
    return this.getMatchAttendanceDetails(date).pipe(
      map(details => details.noResponse)
    );
  }

  /**
   * Refresh the attendance cache
   */
  refreshCache(): Observable<AttendanceRecord[]> {
    this.attendanceCache$.next(null);
    this.cacheTimestamp = 0;
    return this.getCachedAttendance();
  }

  /**
   * Private method to get cached attendance data
   */
  private getCachedAttendance(): Observable<AttendanceRecord[]> {
    const now = Date.now();
    const cachedData = this.attendanceCache$.value;

    if (cachedData && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return of(cachedData);
    }

    return this.googleSheetsService.getSheetData(this.SHEET_NAME).pipe(
      map(rawData => this.parseAttendanceData(rawData)),
      tap(attendance => {
        this.attendanceCache$.next(attendance);
        this.cacheTimestamp = now;
      }),
      shareReplay(1),
      catchError(error => {
        console.error('Error loading attendance data:', error);
        return of([]);
      })
    );
  }

  /**
   * Private method to parse raw sheet data into typed attendance records
   */
  private parseAttendanceData(rawData: any[][]): AttendanceRecord[] {
    if (!rawData || rawData.length <= 1) {
      return [];
    }

    return rawData
      .slice(1) // Skip header row
      .filter(row => row && row.length >= 3 && row[0] && row[1] && row[2])
      .map(row => ({
        date: row[0].toString(),
        playerName: row[1].toString(),
        status: row[2] as AttendanceStatus,
        timestamp: row[3] ? row[3].toString() : undefined
      }));
  }

  /**
   * Private method to apply filters to attendance records
   */
  private applyFilter(records: AttendanceRecord[], filter?: AttendanceFilter): AttendanceRecord[] {
    if (!filter) {
      return records;
    }

    return records.filter(record => {
      if (filter.date && record.date !== filter.date) {
        return false;
      }

      if (filter.fromDate && record.date < filter.fromDate) {
        return false;
      }

      if (filter.toDate && record.date > filter.toDate) {
        return false;
      }

      if (filter.futureOnly) {
        const today = new Date().toISOString().split('T')[0];
        if (record.date <= today) {
          return false;
        }
      }

      if (filter.playerName && record.playerName !== filter.playerName) {
        return false;
      }

      if (filter.status && record.status !== filter.status) {
        return false;
      }

      return true;
    });
  }

  /**
   * Private method to group records by date
   */
  private groupByDate(records: AttendanceRecord[]): { [date: string]: AttendanceRecord[] } {
    return records.reduce((groups, record) => {
      if (!groups[record.date]) {
        groups[record.date] = [];
      }
      groups[record.date].push(record);
      return groups;
    }, {} as { [date: string]: AttendanceRecord[] });
  }

  /**
   * Format date to YYYY-MM-DD format
   */
  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
