import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-chemistry-modal',
  templateUrl: './chemistry-modal.component.html',
  styleUrls: ['./chemistry-modal.component.scss']
})
export class ChemistryModalComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}
}