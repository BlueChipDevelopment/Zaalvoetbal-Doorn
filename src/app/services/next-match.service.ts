import { Injectable } from '@angular/core';
import { GoogleSheetsService } from './google-sheets-service';
import { Observable, map } from 'rxjs';

export interface NextMatchInfo {
  date: string;
  parsedDate: Date | null;
  row: any[];
  location: string;
  time: string;
  matchNumber: string | number | null;
}

@Injectable({ providedIn: 'root' })
export class NextMatchService {
  constructor(private sheets: GoogleSheetsService) {}

  getNextMatchInfo(): Observable<NextMatchInfo | null> {
    return this.sheets.getSheetData('Wedstrijden').pipe(
      map((data: any[][]) => {
        const WHITE_GOALS_COL = 4;
        const RED_GOALS_COL = 5;
        const DATE_COL = 1;
        const nextMatchRow = data.find((row, index) => index > 0 && !row[WHITE_GOALS_COL] && !row[RED_GOALS_COL]);
        if (!nextMatchRow) return null;
        const dateString = nextMatchRow[DATE_COL];
        const parsedDate = new Date(dateString);
        if (!isNaN(parsedDate.getTime())) {
          parsedDate.setHours(20, 30, 0, 0); // vaste tijd 20:30
        }
        return {
          date: dateString,
          parsedDate: !isNaN(parsedDate.getTime()) ? parsedDate : null,
          row: nextMatchRow,
          location: 'Sporthal Steinheim',
          time: '20:30',
          matchNumber: nextMatchRow[0] ?? null,
        };
      })
    );
  }
}
