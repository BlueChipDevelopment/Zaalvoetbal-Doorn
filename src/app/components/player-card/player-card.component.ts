import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { Component, Input } from '@angular/core';
import { Player } from '../../interfaces/IPlayer';

@Component({
  selector: 'app-player-card',
  templateUrl: './player-card.component.html',
  styleUrls: ['./player-card.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule],
})
export class PlayerCardComponent {
  @Input() player!: Player;
  @Input() shirtColor: 'white' | 'red' | string = 'white';
}
