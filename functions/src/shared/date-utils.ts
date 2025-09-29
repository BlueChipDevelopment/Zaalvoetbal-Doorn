import * as logger from "firebase-functions/logger";

/**
 * Parse een datum string in verschillende formaten naar een Date object
 * Ondersteunt Nederlandse datum formaten (dd-mm-yyyy) en ISO formaten
 */
export function parseMatchDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  try {
    // Try to parse Dutch format (dd-mm-yyyy or d-m-yyyy)
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);

        // Valideer dat de delen getallen zijn
        if (isNaN(day) || isNaN(month) || isNaN(year)) {
          logger.warn(`Invalid date parts in "${dateStr}"`);
          return null;
        }

        // Create date in ISO format (year-month-day)
        const matchDate = new Date(year, month - 1, day); // month is 0-indexed

        // Valideer dat de datum geldig is
        if (isNaN(matchDate.getTime())) {
          logger.warn(`Invalid date created from "${dateStr}"`);
          return null;
        }

        return matchDate;
      }
    }

    // Fallback: probeer standaard Date parsing
    const matchDate = new Date(dateStr);
    if (isNaN(matchDate.getTime())) {
      logger.warn(`Could not parse date: "${dateStr}"`);
      return null;
    }

    return matchDate;

  } catch (error) {
    logger.error(`Error parsing date "${dateStr}":`, error);
    return null;
  }
}

/**
 * Converteer een datum naar ISO datum string (YYYY-MM-DD) voor vergelijking
 */
export function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parse een datum string en converteer naar ISO formaat voor vergelijking
 */
export function parseMatchDateToISO(dateStr: string): string | null {
  const date = parseMatchDate(dateStr);
  return date ? toISODateString(date) : null;
}