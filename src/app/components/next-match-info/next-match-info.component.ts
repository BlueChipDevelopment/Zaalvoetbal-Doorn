import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NextMatchInfo } from '../../services/next-match.service';

@Component({
  selector: 'app-next-match-info',
  standalone: true,
  templateUrl: './next-match-info.component.html',
  styleUrls: ['./next-match-info.component.scss'],
  imports: [CommonModule, MatIconModule],
})
export class NextMatchInfoComponent {
  @Input() nextMatchInfo: NextMatchInfo | null = null;
  @Input() matchNumber: string | number | null = null;
}
