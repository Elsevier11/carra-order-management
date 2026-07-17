import { CommonModule } from '@angular/common';
import { Component, Input, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AppComponent } from './app.component';
import { NoteEditorComponent } from './note-editor.component';

@Component({
  selector: 'app-order-detail-checklist',
  standalone: true,
  imports: [CommonModule, FormsModule, NoteEditorComponent],
  templateUrl: './order-detail-checklist.component.html',
  styleUrl: './app.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class OrderDetailChecklistComponent {
  @Input({ required: true }) app!: AppComponent;
  @Input({ required: true }) kind!: 'cementi' | 'accessori';
}
