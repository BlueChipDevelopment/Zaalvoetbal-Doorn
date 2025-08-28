/**
 * Interface representing attendance data from the "Aanwezigheid" Google Sheet
 */
export interface AttendanceRecord {
  /** Kolom A (0): Wedstrijd datum in YYYY-MM-DD formaat */
  date: string;
  /** Kolom B (1): Speler naam */
  playerName: string;
  /** Kolom C (2): Aanwezigheid status */
  status: AttendanceStatus;
  /** Optionele timestamp wanneer status is geregistreerd */
  timestamp?: string;
}

/**
 * Aanwezigheid status opties
 */
export type AttendanceStatus = 'Ja' | 'Nee';

/**
 * Interface voor aanwezigheids overzicht per wedstrijd
 */
export interface MatchAttendanceOverview {
  /** Wedstrijd datum */
  date: string;
  /** Aantal aanwezige spelers */
  presentCount: number;
  /** Aantal afwezige spelers */
  absentCount: number;
  /** Totaal aantal reacties */
  totalResponses: number;
}

/**
 * Interface voor gedetailleerde aanwezigheid per wedstrijd
 */
export interface MatchAttendanceDetails {
  /** Wedstrijd datum */
  date: string;
  /** Lijst van aanwezige spelers */
  present: AttendancePlayerInfo[];
  /** Lijst van afwezige spelers */
  absent: AttendancePlayerInfo[];
  /** Lijst van spelers zonder reactie */
  noResponse: AttendancePlayerInfo[];
}

/**
 * Interface voor gedetailleerde aanwezigheid per wedstrijd inclusief specifieke speler status
 */
export interface MatchAttendanceDetailsWithPlayerStatus extends MatchAttendanceDetails {
  /** Status van een specifieke speler (indien opgevraagd) */
  playerStatus?: AttendanceStatus | null;
}

/**
 * Interface voor speler informatie in aanwezigheidscontext
 */
export interface AttendancePlayerInfo {
  /** Speler naam */
  name: string;
  /** Speler positie */
  position?: string;
  /** Aanwezigheid status */
  status?: AttendanceStatus;
  /** Volledige speler data (indien beschikbaar) */
  playerData?: any;
}

/**
 * Filter opties voor het ophalen van aanwezigheidsgegevens
 */
export interface AttendanceFilter {
  /** Specifieke datum */
  date?: string;
  /** Datum vanaf */
  fromDate?: string;
  /** Datum tot */
  toDate?: string;
  /** Alleen toekomstige wedstrijden */
  futureOnly?: boolean;
  /** Specifieke speler */
  playerName?: string;
  /** Specifieke status */
  status?: AttendanceStatus;
}

/**
 * Interface voor het bijwerken van aanwezigheid
 */
export interface AttendanceUpdate {
  /** Wedstrijd datum */
  date: string;
  /** Speler naam */
  playerName: string;
  /** Nieuwe aanwezigheid status */
  status: AttendanceStatus;
}
