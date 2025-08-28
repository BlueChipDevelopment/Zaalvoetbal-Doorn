import { Injectable } from '@angular/core';
import { WedstrijdData } from '../interfaces/IWedstrijd';

/**
 * Service voor het genereren van unieke wedstrijd-identifiers
 * en het veilig opslaan/ophalen van wedstrijdgegevens
 */
@Injectable({
  providedIn: 'root'
})
export class WedstrijdIdentifierService {

  /**
   * Genereer een unieke identifier voor een wedstrijd
   * Format: "SEIZOEN-WEDSTRIJDNR" (bijv. "2024-2025-001")
   */
  generateUniqueId(seizoen: string | null, wedstrijdNummer: number): string | null {
    if (!seizoen) {
      return null;
    }
    return `${seizoen}-${String(wedstrijdNummer).padStart(3, '0')}`;
  }

  /**
   * Parse een unieke identifier terug naar seizoen en wedstrijdnummer
   */
  parseUniqueId(uniqueId: string): { seizoen: string; wedstrijdNummer: number } | null {
    const match = uniqueId.match(/^(\d{4}-\d{4})-(\d+)$/);
    if (!match) {
      return null;
    }
    return {
      seizoen: match[1],
      wedstrijdNummer: parseInt(match[2], 10)
    };
  }

  /**
   * Controleer of twee wedstrijden dezelfde zijn
   */
  isSameWedstrijd(wedstrijd1: WedstrijdData, wedstrijd2: WedstrijdData): boolean {
    // Als beide seizoen hebben, vergelijk op basis van seizoen + id
    if (wedstrijd1.seizoen && wedstrijd2.seizoen) {
      return wedstrijd1.seizoen === wedstrijd2.seizoen && wedstrijd1.id === wedstrijd2.id;
    }
    
    // Fallback: vergelijk op basis van datum en id
    return wedstrijd1.datum === wedstrijd2.datum && wedstrijd1.id === wedstrijd2.id;
  }

  /**
   * Genereer een leesbare naam voor een wedstrijd
   */
  getWedstrijdDisplayName(wedstrijd: WedstrijdData): string {
    if (wedstrijd.seizoen && wedstrijd.seizoenWedstrijdNummer) {
      return `${wedstrijd.seizoen} Wedstrijd #${wedstrijd.seizoenWedstrijdNummer}`;
    }
    if (wedstrijd.seizoenWedstrijdNummer) {
      return `Wedstrijd #${wedstrijd.seizoenWedstrijdNummer}`;
    }
    return `Wedstrijd #${wedstrijd.id || '?'}`;
  }

  /**
   * Valideer of een wedstrijd veilig is om bij te werken
   * (heeft seizoen en absolute row number)
   */
  isSafeToUpdate(wedstrijd: WedstrijdData): boolean {
    return !!(wedstrijd.seizoen && wedstrijd.absoluteRowNumber);
  }
}
