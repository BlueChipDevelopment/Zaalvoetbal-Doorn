/**
 * Utility functies voor datum parsing en manipulatie
 * Centraliseerde logica om inconsistenties tussen services te voorkomen
 */

/**
 * Parst een datum string in DD-MM-YYYY of YYYY-MM-DD formaat naar een Date object
 * @param dateString Datum string uit Google Sheets
 * @returns Date object of null als parsing faalt
 */
export function parseWedstrijdDate(dateString: string): Date | null {
  if (!dateString || dateString.trim() === '') {
    return null;
  }

  try {
    const parts = dateString.trim().split('-');
    if (parts.length === 3) {
      const part0 = Number(parts[0]);
      const part1 = Number(parts[1]);
      const part2 = Number(parts[2]);

      // Controleer op geldige nummers
      if (isNaN(part0) || isNaN(part1) || isNaN(part2)) {
        return null;
      }

      let parsedDate: Date;
      if (parts[0].length === 4) {
        // YYYY-MM-DD format
        parsedDate = new Date(part0, part1 - 1, part2);
      } else {
        // DD-MM-YYYY format
        parsedDate = new Date(part2, part1 - 1, part0);
      }

      // Controleer of de datum geldig is
      if (isNaN(parsedDate.getTime())) {
        return null;
      }

      return parsedDate;
    }
  } catch (error) {
    console.warn('Error parsing date:', dateString, error);
  }

  return null;
}

/**
 * Parst een wedstrijd datum en zet de tijd op 20:30
 * @param dateString Datum string uit Google Sheets
 * @returns Date object met tijd 20:30 of null
 */
export function parseWedstrijdDateTime(dateString: string): Date | null {
  const date = parseWedstrijdDate(dateString);
  if (date) {
    date.setHours(20, 30, 0, 0);
  }
  return date;
}

/**
 * Sorteert wedstrijden op datum (vroegste eerst)
 * @param a Eerste wedstrijd
 * @param b Tweede wedstrijd
 * @returns Sorteer resultaat (-1, 0, 1)
 */
export function sortWedstrijdenByDate(a: { datum: Date | null }, b: { datum: Date | null }): number {
  if (!a.datum || !b.datum) return 0;
  return a.datum.getTime() - b.datum.getTime();
}

/**
 * Legacy version: Sorteert wedstrijden op datum string (vroegste eerst)
 * @param a Eerste wedstrijd
 * @param b Tweede wedstrijd
 * @returns Sorteer resultaat (-1, 0, 1)
 * @deprecated Use sortWedstrijdenByDate instead for Date objects
 */
export function sortWedstrijdenByDateString(a: { datum: string }, b: { datum: string }): number {
  const dateA = parseWedstrijdDate(a.datum);
  const dateB = parseWedstrijdDate(b.datum);

  if (!dateA || !dateB) return 0;
  return dateA.getTime() - dateB.getTime();
}

// === NIEUWE STANDAARD FORMATTING FUNCTIES ===

/**
 * Formatteert een Date naar ISO string formaat (YYYY-MM-DD)
 * @param date Date object
 * @returns ISO datum string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formatteert een Date voor Nederlandse weergave (dd MMMM yyyy)
 * @param date Date object
 * @returns Nederlandse datum string
 */
export function formatDateForDisplay(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Formatteert een Date voor korte Nederlandse weergave (dd-mm-yyyy)
 * @param date Date object
 * @returns Nederlandse datum string (dd-mm-yyyy)
 */
export function formatDateShort(date: Date | null): string {
  if (!date) return '';
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Geeft de huidige datum als ISO string (YYYY-MM-DD)
 * @returns ISO datum string van vandaag
 */
export function getCurrentDateISO(): string {
  return formatDateISO(new Date());
}

/**
 * Geeft de huidige datum en tijd als ISO string
 * @returns ISO datetime string
 */
export function getCurrentDateTimeISO(): string {
  return new Date().toISOString();
}

/**
 * Parse datum met fallback en error handling
 * @param dateInput String, Date object, of null/undefined
 * @returns Date object of null als parsing faalt
 */
export function parseDate(dateInput: string | Date | null | undefined): Date | null {
  if (!dateInput) return null;

  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }

  // Probeer eerst wedstrijd datum parsing (voor Nederlandse formaten)
  const wedstrijdDate = parseWedstrijdDate(dateInput);
  if (wedstrijdDate) return wedstrijdDate;

  // Fallback naar standaard Date parsing
  try {
    const date = new Date(dateInput);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.warn('Error parsing date:', dateInput, error);
    return null;
  }
}
