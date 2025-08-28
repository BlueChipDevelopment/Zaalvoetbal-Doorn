export interface WedstrijdData {
  id?: number;
  seizoen?: string | null; // Seizoen in formaat "2024-2025", null als datum niet parseerbaar is
  seizoenWedstrijdNummer?: number; // Wedstrijdnummer binnen het seizoen (1, 2, 3, ...)
  datum: string;
  teamWit: string;
  teamRood: string;
  scoreWit: number | null;
  scoreRood: number | null;
  zlatan: string;
  ventiel: string;
  locatie?: string;
  // Voor backwards compatibility
  absoluteRowNumber?: number; // De werkelijke rijnummer in de sheet
}

export interface WedstrijdFilter {
  seizoen?: string;
  gespeeld?: boolean; // true = alleen gespeelde wedstrijden, false = alleen toekomstige, undefined = alle
  teamFilter?: string; // filter op team naam
}

export interface SeizoenData {
  seizoen: string;
  aantalWedstrijden: number;
  aantalGespeeld: number;
}
