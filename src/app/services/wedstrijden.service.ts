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
            const seizoen = this.getSeizoenFromDate(wedstrijd.datum);
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

    // Skip header row (index 0)
    return rawData.slice(1)
      .filter(row => row && row.length > 0)
      .map((row, index) => ({
        id: index + 1,
        datum: row[1] || '',
        teamWit: row[2] || '',
        teamRood: row[3] || '',
        scoreWit: this.parseScore(row[4]),
        scoreRood: this.parseScore(row[5]),
        zlatan: row[6] || '',
        ventiel: row[7] || '',
        locatie: 'Sporthal Steinheim' // Default locatie
      }));
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
        const wedstrijdSeizoen = this.getSeizoenFromDate(w.datum);
        return wedstrijdSeizoen === filter.seizoen;
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

  private getSeizoenFromDate(dateString: string): string | null {
    if (!dateString || dateString.trim() === '') {
      return null;
    }

    try {
      // Ondersteun verschillende datumformaten
      let parsedDate: Date;
      
      if (dateString.includes('-')) {
        const parts = dateString.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD format
            parsedDate = new Date(dateString);
          } else {
            // DD-MM-YYYY format
            parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          }
        } else {
          return null;
        }
      } else {
        // Probeer direct te parsen
        parsedDate = new Date(dateString);
      }

      if (isNaN(parsedDate.getTime())) {
        return null;
      }

      const year = parsedDate.getFullYear();
      const month = parsedDate.getMonth() + 1; // getMonth() is 0-based

      // Futsal seizoen loopt typisch van augustus tot juli
      if (month >= 8) {
        // Augustus-December: seizoen YYYY-(YYYY+1)
        return `${year}-${year + 1}`;
      } else {
        // Januari-Juli: seizoen (YYYY-1)-YYYY
        return `${year - 1}-${year}`;
      }
    } catch (error) {
      console.warn('Error parsing date for seizoen:', dateString, error);
      return null;
    }
  }
}
