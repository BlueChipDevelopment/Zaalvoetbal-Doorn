import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chemistry-modal',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    CommonModule
  ],
  templateUrl: './chemistry-modal.component.html',
  styleUrls: ['./chemistry-modal.component.scss']
})
export class ChemistryModalComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}
}