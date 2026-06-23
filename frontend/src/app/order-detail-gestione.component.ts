import { CommonModule } from '@angular/common';
import { Component, Input, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-order-detail-gestione',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-detail-gestione.component.html',
  styleUrl: './app.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class OrderDetailGestioneComponent {
  @Input({ required: true }) app!: any;
  @Input({ required: true }) detail!: any;
}
