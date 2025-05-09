import { Component, OnInit } from '@angular/core';
import { GoogleSheetsService } from '../../services/google-sheets-service';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-wedstrijden',
  standalone: true,
  imports: [MatProgressSpinnerModule, CommonModule],
  templateUrl: './wedstrijden.component.html',
  styleUrl: './wedstrijden.component.scss'
})
export class WedstrijdenComponent implements OnInit {
  wedstrijden: any[] = [];
  isLoading = true;
  errorMessage = '';

  constructor(private googleSheetsService: GoogleSheetsService) {}

  ngOnInit(): void {
    this.googleSheetsService.getSheetData('Wedstrijden').subscribe({
      next: (data: any[][]) => {
        // Eerste rij is header, filter alleen wedstrijden met score
        this.wedstrijden = (data || [])
          .filter((row, idx) => idx > 0 && row[4] && row[5])
          .map(row => ({
            date: row[1],
            teamWhite: row[2],
            teamRed: row[3],
            scoreWhite: row[4],
            scoreRed: row[5],
            zlatan: row[6],
            ventiel: row[7],
            locatie: 'Sporthal Steinheim'
          }))
          .sort((a, b) => {
            // Verwacht formaat: DD-MM-YYYY of YYYY-MM-DD
            const parse = (d: string) => {
              const parts = d.split('-');
              if (parts[0].length === 4) return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
              return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            };
            return parse(b.date).getTime() - parse(a.date).getTime();
          });
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Fout bij het laden van wedstrijden.';
        this.isLoading = false;
      }
    });
  }
}
