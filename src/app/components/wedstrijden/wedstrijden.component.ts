import { Component, OnInit } from '@angular/core';
import { WedstrijdenService } from '../../services/wedstrijden.service';
import { WedstrijdData } from '../../interfaces/IWedstrijd';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatError } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-wedstrijden',
  standalone: true,
  imports: [MatProgressSpinnerModule, CommonModule, MatError, MatIconModule],
  templateUrl: './wedstrijden.component.html',
  styleUrl: './wedstrijden.component.scss'
})
export class WedstrijdenComponent implements OnInit {
  wedstrijden: WedstrijdData[] = [];
  isLoading = true;
  errorMessage: string | null = null;

  constructor(private wedstrijdenService: WedstrijdenService) {}

  ngOnInit(): void {
    this.wedstrijdenService.getGespeeldeWedstrijden().subscribe({
      next: (wedstrijden: WedstrijdData[]) => {
        // Sort by date, most recent first
        this.wedstrijden = wedstrijden.sort((a, b) => {
          // Verwacht formaat: DD-MM-YYYY of YYYY-MM-DD
          const parse = (d: string) => {
            const parts = d.split('-');
            if (parts[0].length === 4) return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
          };
          return parse(b.datum).getTime() - parse(a.datum).getTime();
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
