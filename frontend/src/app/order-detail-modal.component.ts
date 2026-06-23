import { CommonModule } from '@angular/common';
import { Component, Input, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrderDetailCamComponent } from './order-detail-cam.component';
import { OrderDetailChecklistComponent } from './order-detail-checklist.component';
import { OrderDetailDettagliComponent } from './order-detail-dettagli.component';
import { OrderDetailGestioneComponent } from './order-detail-gestione.component';

@Component({
  selector: 'app-order-detail-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, OrderDetailDettagliComponent, OrderDetailGestioneComponent, OrderDetailChecklistComponent, OrderDetailCamComponent],
  templateUrl: './order-detail-modal.component.html',
  styleUrl: './app.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class OrderDetailModalComponent {
  @Input({ required: true }) app!: any;
}
