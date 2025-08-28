export interface WedstrijdData {
  id?: number;
  datum: string;
  teamWit: string;
  teamRood: string;
  scoreWit: number | null;
  scoreRood: number | null;
  zlatan: string;
  ventiel: string;
  locatie?: string;
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
