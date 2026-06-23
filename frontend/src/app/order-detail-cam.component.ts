import { CommonModule } from '@angular/common';
import { Component, Input, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-order-detail-cam',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-detail-cam.component.html',
  styleUrl: './app.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class OrderDetailCamComponent {
  @Input({ required: true }) app!: any;
  @Input({ required: true }) detail!: any;
}
