import { Injectable } from '@angular/core';
import { WedstrijdenService } from './wedstrijden.service';
import { WedstrijdData } from '../interfaces/IWedstrijd';
import { Observable, map } from 'rxjs';

export interface NextMatchInfo {
  date: string; // Keep original string for display
  parsedDate: Date | null;
  wedstrijd: WedstrijdData;
  location: string;
  time: string;
  matchNumber: number | null;
  rowNumber?: number;
  seizoen?: string | null; // Seizoen voor unieke identificatie
}

export interface FutureMatchInfo {
  date: string; // Keep original string for display
  parsedDate: Date | null;
  wedstrijd: WedstrijdData;
  location: string;
  time: string;
  matchNumber: number | null;
}

@Injectable({ providedIn: 'root' })
export class NextMatchService {
  constructor(private wedstrijdenService: WedstrijdenService) {}

  getNextMatchInfo(): Observable<NextMatchInfo | null> {
    return this.wedstrijdenService.getToekomstigeWedstrijden().pipe(
      map((wedstrijden: WedstrijdData[]) => {
        // Vind de eerst volgende wedstrijd (gesorteerd op datum)
        const nextWedstrijd = wedstrijden
          .filter(w => w.datum !== null) // Filter out matches with no valid date
          .sort((a, b) => {
            // Both dates are already parsed Date objects, so just compare time values
            return a.datum!.getTime() - b.datum!.getTime();
          })[0];

        if (!nextWedstrijd || !nextWedstrijd.datum) return null;

        return {
          date: nextWedstrijd.datumString || '', // Use original string for display
          parsedDate: nextWedstrijd.datum, // Already a Date object
          wedstrijd: nextWedstrijd,
          location: nextWedstrijd.locatie || 'Sporthal Steinheim',
          time: '20:30',
          matchNumber: nextWedstrijd.seizoenWedstrijdNummer ?? nextWedstrijd.id ?? null,
          rowNumber: nextWedstrijd.absoluteRowNumber || (nextWedstrijd.id ? Number(nextWedstrijd.id) + 1 : undefined),
          seizoen: nextWedstrijd.seizoen,
        };
      })
    );
  }

  getFutureMatches(): Observable<FutureMatchInfo[]> {
    return this.wedstrijdenService.getToekomstigeWedstrijden().pipe(
      map((wedstrijden: WedstrijdData[]) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return wedstrijden
          .filter(wedstrijd => wedstrijd.datum !== null) // Filter out matches with no valid date
          .map(wedstrijd => ({
            date: wedstrijd.datumString || '', // Use original string for display
            parsedDate: wedstrijd.datum, // Already a Date object
            wedstrijd: wedstrijd,
            location: wedstrijd.locatie || 'Sporthal Steinheim',
            time: '20:30',
            matchNumber: wedstrijd.seizoenWedstrijdNummer ?? wedstrijd.id ?? null
          }))
          .filter(match => match.parsedDate && match.parsedDate >= today)
          .sort((a, b) => {
            if (!a.parsedDate || !b.parsedDate) return 0;
            return a.parsedDate.getTime() - b.parsedDate.getTime();
          });
      })
    );
  }
}
