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
  rowNumber?: number; // Toegevoegd
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

        // Parse dateString as DD-MM-YYYY or YYYY-MM-DD
        let parsedDate: Date | null = null;
        if (typeof dateString === 'string') {
          const parts = dateString.split('-');
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              // YYYY-MM-DD
              parsedDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            } else {
              // DD-MM-YYYY
              parsedDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            }
          } else {
            parsedDate = new Date(dateString);
          }
        }
        if (parsedDate && !isNaN(parsedDate.getTime())) {
          parsedDate.setHours(20, 30, 0, 0); // vaste tijd 20:30
        } else {
          parsedDate = null;
        }

        // Zoek de rij-index op (1-based)
        const rowNumber = data.findIndex(row => row === nextMatchRow);

        return {
          date: dateString,
          parsedDate: parsedDate,
          row: nextMatchRow,
          location: 'Sporthal Steinheim',
          time: '20:30',
          matchNumber: nextMatchRow[0] ?? null,
          rowNumber: rowNumber > -1 ? rowNumber + 1 : undefined,
        };
      })
    );
  }
}
