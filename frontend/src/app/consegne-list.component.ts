import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ConsegnaRecord } from './consegne.types';
import type { KanbanBoardHost } from './kanban-board.component';
import { deliveryBadgeText, deliveryDateValue } from './order-formatters';

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
    return [...items].sort((a, b) => this.deliverySortValue(a) - this.deliverySortValue(b) || a.rif.localeCompare(b.rif, 'it'));
  }

  deliveryDateLabel(item: ConsegnaRecord): string {
    const value = this.deliveryDateValueForItem(item);
    const second = this.deliveryDateSecondValue(item);
    if (!value && !second) return '—';
    const firstLabel = value ? this.formatDate(value) : '—';
    if (!second) return firstLabel;
    const secondLabel = this.formatDate(second);
    return `${firstLabel} + ${secondLabel}`;
  }

  deliveryTypeLabel(item: ConsegnaRecord): string {
    return deliveryBadgeText(item);
  }

  vettoreLabel(item: ConsegnaRecord): string {
    const first = this.app.nomeVettore(item.vettoreId);
    const second = this.app.nomeVettore(item.vettoreSecondoId ?? null);
    if (!second || second === '—') return first;
    return first && first !== '—' ? `${first} + ${second}` : second;
  }

  biliciLabel(item: ConsegnaRecord): string {
    if (item.biliciSecondi != null && item.biliciSecondi > 0) {
      return `${item.bilici} + ${item.biliciSecondi}`;
    }
    return `${item.bilici}`;
  }

  problemiScaricoLabel(item: ConsegnaRecord): string | null {
    if (item.stato !== 'CONSEGNA EFFETTUATA') return null;
    const note = item.problemiScaricoNota?.trim();
    if (!note) return null;
    return `Problemi scarico: ${note}`;
  }

  private deliveryDateValueForItem(item: ConsegnaRecord): string | null {
    return deliveryDateValue(item);
  }

  private deliveryDateSecondValue(item: ConsegnaRecord): string | null {
    return item.consegnaDataEffettivaSeconda ?? null;
  }

  private formatDate(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('it-IT');
  }

  private deliverySortValue(item: ConsegnaRecord): number {
    const value = this.deliveryDateValueForItem(item);
    if (!value) return Number.NEGATIVE_INFINITY;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? Number.NEGATIVE_INFINITY : parsed.getTime();
  }
}
