import { Injectable } from '@angular/core';
import { WedstrijdenService } from './wedstrijden.service';
import { WedstrijdData } from '../interfaces/IWedstrijd';
import { Observable, map } from 'rxjs';

export interface NextMatchInfo {
  date: string;
  parsedDate: Date | null;
  wedstrijd: WedstrijdData;
  location: string;
  time: string;
  matchNumber: number | null;
  rowNumber?: number;
  seizoen?: string | null; // Seizoen voor unieke identificatie
}

export interface FutureMatchInfo {
  date: string;
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
          .filter(w => w.datum && w.datum.trim() !== '')
          .sort((a, b) => {
            const parseDate = (dateString: string): Date => {
              const parts = dateString.split('-');
              if (parts.length === 3) {
                if (parts[0].length === 4) {
                  // YYYY-MM-DD
                  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                } else {
                  // DD-MM-YYYY
                  return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                }
              }
              return new Date(dateString);
            };
            return parseDate(a.datum).getTime() - parseDate(b.datum).getTime();
          })[0];

        if (!nextWedstrijd) return null;

        const dateString = nextWedstrijd.datum;
        
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

        // Debug logging voor wedstrijdnummer probleem
        const matchNumber = nextWedstrijd.seizoenWedstrijdNummer ?? nextWedstrijd.id ?? null;
        
        // Tijdelijke alert voor mobile debugging
        const debugInfo = `NextMatch: datum=${nextWedstrijd.datum}, seizoenNr=${nextWedstrijd.seizoenWedstrijdNummer}, id=${nextWedstrijd.id}, final=${matchNumber}`;
        console.log('NextMatch Debug:', {
          datum: nextWedstrijd.datum,
          seizoenWedstrijdNummer: nextWedstrijd.seizoenWedstrijdNummer,
          id: nextWedstrijd.id,
          finalMatchNumber: matchNumber,
          seizoen: nextWedstrijd.seizoen
        });
        
        // Alert voor mobile (tijdelijk)
        if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('Mobile')) {
          alert(debugInfo);
        }

        return {
          date: dateString,
          parsedDate: parsedDate,
          wedstrijd: nextWedstrijd,
          location: nextWedstrijd.locatie || 'Sporthal Steinheim',
          time: '20:30',
          matchNumber: matchNumber,
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
          .filter(wedstrijd => wedstrijd.datum && wedstrijd.datum.trim() !== '')
          .map(wedstrijd => {
            const dateString = wedstrijd.datum;
            
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

            // Debug logging voor wedstrijdnummer probleem in toekomstige wedstrijden
            const matchNumber = wedstrijd.seizoenWedstrijdNummer ?? wedstrijd.id ?? null;
            console.log('FutureMatch Debug:', {
              datum: wedstrijd.datum,
              seizoenWedstrijdNummer: wedstrijd.seizoenWedstrijdNummer,
              id: wedstrijd.id,
              finalMatchNumber: matchNumber,
              seizoen: wedstrijd.seizoen
            });

            return {
              date: dateString,
              parsedDate: parsedDate,
              wedstrijd: wedstrijd,
              location: wedstrijd.locatie || 'Sporthal Steinheim',
              time: '20:30',
              matchNumber: matchNumber
            };
          })
          .filter(match => match.parsedDate && match.parsedDate >= today)
          .sort((a, b) => {
            if (!a.parsedDate || !b.parsedDate) return 0;
            return a.parsedDate.getTime() - b.parsedDate.getTime();
          });
      })
    );
  }
}
