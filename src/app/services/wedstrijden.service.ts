import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, tap, catchError, shareReplay } from 'rxjs/operators';
import { GoogleSheetsService } from './google-sheets-service';
import { WedstrijdData, WedstrijdFilter, SeizoenData } from '../interfaces/IWedstrijd';

@Injectable({
  providedIn: 'root'
})
export class WedstrijdenService {
  private readonly SHEET_NAME = 'Wedstrijden';
  private wedstrijdenCache$ = new BehaviorSubject<WedstrijdData[] | null>(null);
  private cacheTimestamp = 0;
  private readonly CACHE_DURATION = 3 * 60 * 1000; // 3 minutes cache

  constructor(private googleSheetsService: GoogleSheetsService) {}

  /**
   * Get all wedstrijden from the Wedstrijden sheet with optional filtering
   */
  getWedstrijden(filter?: WedstrijdFilter): Observable<WedstrijdData[]> {
    return this.getCachedWedstrijden().pipe(
      map(wedstrijden => this.applyFilter(wedstrijden, filter))
    );
  }

  /**
   * Get only played matches (with scores)
   */
  getGespeeldeWedstrijden(): Observable<WedstrijdData[]> {
    return this.getWedstrijden({ gespeeld: true });
  }

  /**
   * Get only upcoming matches (without scores)
   */
  getToekomstigeWedstrijden(): Observable<WedstrijdData[]> {
    return this.getWedstrijden({ gespeeld: false });
  }

  /**
   * Get available seasons from wedstrijden data
   */
  getBeschikbareSeizoen(): Observable<SeizoenData[]> {
    return this.getCachedWedstrijden().pipe(
      map(wedstrijden => {
        const seizoenMap = new Map<string, { totaal: number; gespeeld: number }>();
        
        wedstrijden
          .filter(w => w.datum && w.datum.trim() !== '')
          .forEach(wedstrijd => {
            const seizoen = wedstrijd.seizoen;
            if (seizoen) {
              if (!seizoenMap.has(seizoen)) {
                seizoenMap.set(seizoen, { totaal: 0, gespeeld: 0 });
              }
              const stats = seizoenMap.get(seizoen)!;
              stats.totaal++;
              if (wedstrijd.scoreWit !== null && wedstrijd.scoreRood !== null) {
                stats.gespeeld++;
              }
            }
          });

        return Array.from(seizoenMap.entries())
          .map(([seizoen, stats]) => ({
            seizoen,
            aantalWedstrijden: stats.totaal,
            aantalGespeeld: stats.gespeeld
          }))
          .sort((a, b) => b.seizoen.localeCompare(a.seizoen)); // Nieuwste eerst
      })
    );
  }

  /**
   * Get wedstrijden for a specific season
   */
  getWedstrijdenVoorSeizoen(seizoen: string): Observable<WedstrijdData[]> {
    return this.getWedstrijden({ seizoen });
  }

  /**
   * Refresh the cache by fetching fresh data
   */
  refreshCache(): Observable<WedstrijdData[]> {
    this.wedstrijdenCache$.next(null);
    this.cacheTimestamp = 0;
    return this.getCachedWedstrijden();
  }

  /**
   * Find a wedstrijd by seizoen and wedstrijdnummer for safe updates
   */
  findWedstrijdBySeizoenAndNummer(seizoen: string, wedstrijdNummer: number): Observable<WedstrijdData | null> {
    return this.getCachedWedstrijden().pipe(
      map(wedstrijden => {
        return wedstrijden.find(w => 
          w.seizoen === seizoen && w.id === wedstrijdNummer
        ) || null;
      })
    );
  }

  private getCachedWedstrijden(): Observable<WedstrijdData[]> {
    const now = Date.now();
    const cachedData = this.wedstrijdenCache$.value;

    if (cachedData && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return of(cachedData);
    }

    return this.googleSheetsService.getSheetData(this.SHEET_NAME).pipe(
      map(data => this.transformRawData(data)),
      tap(wedstrijden => {
        this.wedstrijdenCache$.next(wedstrijden);
        this.cacheTimestamp = now;
      }),
      catchError(error => {
        console.error('Error fetching wedstrijden data:', error);
        return of([]);
      }),
      shareReplay(1)
    );
  }

  private transformRawData(rawData: any[][]): WedstrijdData[] {
    if (!rawData || rawData.length <= 1) {
      return [];
    }

    // Skip header row (index 0) en transform eerst alle basis data
    const baseWedstrijden = rawData.slice(1)
      .filter(row => row && row.length > 0)
      .map((row, index) => {
        const absoluteRowNumber = index + 2; // +2 omdat we header overslaan en Excel is 1-based
        const seizoen = row[1] || ''; // Kolom B = seizoen (bijvoorbeeld "2025-2026")
        const datum = row[2] || ''; // Datum is nu kolom C
        
        // Probeer eerst ID uit sheet (kolom A), fallback naar berekening
        let id: number;
        const sheetId = this.parseScore(row[0]); // row[0] = kolom A
        if (sheetId !== null && sheetId > 0) {
          id = sheetId; // Gebruik ID uit sheet
        } else {
          id = index + 1; // Fallback naar oude berekening
          console.warn(`Wedstrijd rij ${absoluteRowNumber}: Geen geldig ID in kolom A (${row[0]}), gebruik fallback ${id}`);
        }
        
        return {
          id: id,
          seizoen: seizoen.trim(), // Direct uit kolom B
          absoluteRowNumber: absoluteRowNumber,
          datum: datum,
          teamWit: row[3] || '', // Kolom D
          teamRood: row[4] || '', // Kolom E
          scoreWit: this.parseScore(row[5]), // Kolom F
          scoreRood: this.parseScore(row[6]), // Kolom G
          zlatan: row[7] || '', // Kolom H
          ventiel: row[8] || '', // Kolom I
          locatie: 'Sporthal Steinheim' // Default locatie
        };
      });

    // Nu seizoen wedstrijdnummers berekenen per seizoen
    const seizoenCounters = new Map<string, number>();
    
    return baseWedstrijden.map(wedstrijd => {
      // Controleer of seizoen aanwezig is (uit kolom B)
      if (!wedstrijd.seizoen) {
        console.warn(`Wedstrijd ${wedstrijd.datum}: Geen seizoen in kolom B gevonden`);
        return wedstrijd; // Geen seizoenWedstrijdNummer als seizoen ontbreekt
      }
      
      const currentCount = seizoenCounters.get(wedstrijd.seizoen) || 0;
      const seizoenWedstrijdNummer = currentCount + 1;
      seizoenCounters.set(wedstrijd.seizoen, seizoenWedstrijdNummer);
      
      return {
        ...wedstrijd,
        seizoenWedstrijdNummer
      };
    });
  }

  private parseScore(scoreValue: any): number | null {
    if (scoreValue === null || scoreValue === undefined || scoreValue === '') {
      return null;
    }
    const parsed = parseInt(scoreValue, 10);
    return isNaN(parsed) ? null : parsed;
  }

  private applyFilter(wedstrijden: WedstrijdData[], filter?: WedstrijdFilter): WedstrijdData[] {
    if (!filter) {
      return wedstrijden;
    }

    let filtered = wedstrijden;

    // Filter by seizoen
    if (filter.seizoen) {
      filtered = filtered.filter(w => {
        return w.seizoen === filter.seizoen; // Nu direct uit kolom B
      });
    }

    // Filter by gespeeld status
    if (filter.gespeeld !== undefined) {
      filtered = filtered.filter(w => {
        const isGespeeld = w.scoreWit !== null && w.scoreRood !== null;
        return filter.gespeeld ? isGespeeld : !isGespeeld;
      });
    }

    // Filter by team
    if (filter.teamFilter) {
      const teamFilter = filter.teamFilter.toLowerCase();
      filtered = filtered.filter(w => 
        w.teamWit.toLowerCase().includes(teamFilter) || 
        w.teamRood.toLowerCase().includes(teamFilter)
      );
    }

    return filtered;
  }
}
