import { CommonModule } from '@angular/common';
import { Component, Input, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-order-detail-checklist',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-detail-checklist.component.html',
  styleUrl: './app.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class OrderDetailChecklistComponent {
  @Input({ required: true }) app!: any;
  @Input({ required: true }) kind!: 'cementi' | 'accessori';
}
