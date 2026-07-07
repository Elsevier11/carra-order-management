import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ConsegnaRecord } from './consegne.types';
import type { KanbanBoardHost } from './kanban-board.component';

@Component({
  selector: 'app-consegne-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consegne-list.component.html',
  styleUrl: './consegne-list.component.scss',
})
export class ConsegneListComponent {
  @Input({ required: true }) app!: KanbanBoardHost;

  readonly sections: Array<{ status: string; label: string }> = [
    { status: 'CONSEGNA PIANIFICATA', label: 'Consegna Pianificata' },
    { status: 'CONSEGNA EFFETTUATA', label: 'Consegna Effettuata' },
  ];

  itemsForStatus(status: string): ConsegnaRecord[] {
    return this.app.boardColumns.find((column) => column.status === status)?.items ?? [];
  }

  sectionItems(status: string): ConsegnaRecord[] {
    const items = this.app.filteredKanbanItems(this.itemsForStatus(status));
    return [...items].sort((a, b) => this.deliverySortValue(b) - this.deliverySortValue(a) || a.rif.localeCompare(b.rif, 'it'));
  }

  deliveryDateLabel(item: ConsegnaRecord): string {
    const value = this.deliveryDateValue(item);
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('it-IT');
  }

  vettoreLabel(item: ConsegnaRecord): string {
    return this.app.nomeVettore(item.vettoreId);
  }

  private deliveryDateValue(item: ConsegnaRecord): string | null {
    return item.consegnaDataEffettiva ?? item.dataConsegna;
  }

  private deliverySortValue(item: ConsegnaRecord): number {
    const value = this.deliveryDateValue(item);
    if (!value) return Number.NEGATIVE_INFINITY;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? Number.NEGATIVE_INFINITY : parsed.getTime();
  }
}
