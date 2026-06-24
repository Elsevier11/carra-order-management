import { CommonModule } from '@angular/common';
import { Component, Input, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AppComponent } from './app.component';
import type { ConsegnaRecord } from './consegne.types';

@Component({
  selector: 'app-order-detail-dettagli',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-detail-dettagli.component.html',
  styleUrl: './app.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class OrderDetailDettagliComponent {
  @Input({ required: true }) app!: AppComponent;
  @Input({ required: true }) detail!: ConsegnaRecord;
}
