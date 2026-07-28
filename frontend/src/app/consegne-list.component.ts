import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ConsegnaRecord } from './consegne.types';
import type { KanbanBoardHost } from './kanban-board.component';
import { deliveryBadgeText, deliveryDateValue } from './order-formatters';
import { buildDeliveryPlanFromLegacy, normalizeDeliveryPlanEntries } from '../../../src/shared/delivery-plan';

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
    const entries = this.deliveryEntries(item);
    if (!entries.length) return '—';
    return entries.map((entry, index) => `${index + 1}a ${this.formatDate(entry.data)}`).join(' · ');
  }

  deliveryTypeLabel(item: ConsegnaRecord): string {
    return deliveryBadgeText(item);
  }

  vettoreLabel(item: ConsegnaRecord): string {
    const entries = this.deliveryEntries(item);
    if (!entries.length) return this.app.nomeVettore(item.vettoreId);
    const labels = entries
      .map((entry, index) => {
        const value = this.app.nomeVettore(entry.vettoreId);
        return value && value !== '—' ? `${index + 1}a ${value}` : '';
      })
      .filter(Boolean);
    return labels.length ? labels.join(' · ') : '—';
  }

  biliciLabel(item: ConsegnaRecord): string {
    const entries = this.deliveryEntries(item);
    if (!entries.length) return `${item.bilici}`;
    const labels = entries
      .map((entry, index) => (entry.bilici != null ? `${index + 1}a ${entry.bilici}` : ''))
      .filter(Boolean);
    return labels.length ? labels.join(' · ') : `${item.bilici}`;
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

  private deliveryEntries(item: ConsegnaRecord): Array<{ data: string; vettoreId: number | null; bilici: number | null }> {
    return normalizeDeliveryPlanEntries(item.deliveryPlan?.length ? item.deliveryPlan : buildDeliveryPlanFromLegacy(item))
      .filter((entry) => !!entry.data || !!entry.vettoreId || (entry.bilici ?? 0) > 0);
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
