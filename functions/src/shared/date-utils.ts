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

/**
 * Parse een datum string naar een Date object met specifieke tijd in Europe/Amsterdam timezone
 * @param dateStr - Datum string (dd-mm-yyyy of yyyy-mm-dd)
 * @param timeStr - Tijd string (HH:mm:ss), default is '20:30:00'
 * @returns Date object in UTC die overeenkomt met de gegeven tijd in Europe/Amsterdam
 */
export function parseMatchDateWithTime(dateStr: string, timeStr: string = '20:30:00'): Date | null {
  if (!dateStr) return null;

  try {
    const date = parseMatchDate(dateStr);
    if (!date) return null;

    // Parse tijd (HH:mm:ss)
    const timeParts = timeStr.split(':');
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    const seconds = timeParts[2] ? parseInt(timeParts[2], 10) : 0;

    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
      logger.warn(`Invalid time parts in "${timeStr}"`);
      return null;
    }

    // Maak ISO string met Europe/Amsterdam timezone offset
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // Bepaal timezone offset voor Europe/Amsterdam
    // Zomertijd (CEST): UTC+2, van laatste zondag maart tot laatste zondag oktober
    // Wintertijd (CET): UTC+1
    // Voor simplicity: april t/m september is altijd zomertijd
    const monthNum = date.getMonth(); // 0-indexed
    const isLikelyDST = monthNum >= 3 && monthNum <= 8; // april (3) t/m september (8)
    const offset = isLikelyDST ? '+02:00' : '+01:00';

    // Maak ISO string met timezone en parse naar Date
    const isoString = `${year}-${month}-${day}T${time}${offset}`;
    const result = new Date(isoString);

    if (isNaN(result.getTime())) {
      logger.warn(`Invalid date created from "${isoString}"`);
      return null;
    }

    return result;

  } catch (error) {
    logger.error(`Error parsing date with time "${dateStr} ${timeStr}":`, error);
    return null;
  }
}