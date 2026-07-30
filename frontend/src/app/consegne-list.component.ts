import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ConsegnaRecord } from './consegne.types';
import type { KanbanBoardHost } from './kanban-board.component';
import type { BoardInfoBadge } from './order-formatters';
import { boardConsegnaPianificataBadges, deliveryBadgeText as formatDeliveryBadgeText, deliveryDateValue } from './order-formatters';
import { buildDeliveryPlanFromLegacy, normalizeDeliveryPlanEntries } from '../../../src/shared/delivery-plan';

interface WeekGroup {
  key: number;
  label: string;
  items: ConsegnaRecord[];
}

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

  sectionWeekGroups(status: string): WeekGroup[] {
    return this.buildWeekGroups(this.sectionItems(status));
  }

  deliveryDateLabel(item: ConsegnaRecord): string {
    const entries = this.deliveryEntries(item);
    if (!entries.length) return '—';
    return entries.map((entry, index) => `${index + 1}a ${this.formatDate(entry.data)}`).join(' · ');
  }

  deliveryTypeLabel(item: ConsegnaRecord): string {
    return formatDeliveryBadgeText(item);
  }

  deliveryBadgeText(item: ConsegnaRecord): string {
    return formatDeliveryBadgeText(item);
  }

  deliveryPlanBadges(item: ConsegnaRecord): BoardInfoBadge[] {
    return boardConsegnaPianificataBadges(item, (id: number | null | undefined) => this.app.nomeVettore(id));
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

  private buildWeekGroups(items: ConsegnaRecord[]): WeekGroup[] {
    const groups = new Map<number, WeekGroup>();
    const noDate: ConsegnaRecord[] = [];

    for (const item of items) {
      const value = this.deliveryDateValueForItem(item);
      if (!value) {
        noDate.push(item);
        continue;
      }

      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        noDate.push(item);
        continue;
      }

      const week = this.isoWeek(parsed);
      const year = this.isoWeekYear(parsed);
      const key = year * 100 + week;
      if (!groups.has(key)) {
        const { mon, sun } = this.weekRange(parsed);
        groups.set(key, {
          key,
          label: `SETT. ${String(week).padStart(2, '0')} — DAL ${mon} AL ${sun}`,
          items: [],
        });
      }
      groups.get(key)!.items.push(item);
    }

    const sorted = [...groups.values()]
      .map((group) => ({
        ...group,
        items: [...group.items].sort(
          (a, b) => this.deliverySortValue(b) - this.deliverySortValue(a) || a.rif.localeCompare(b.rif, 'it'),
        ),
      }))
      .sort((a, b) => a.key - b.key);

    if (noDate.length) {
      sorted.push({
        key: Number.MAX_SAFE_INTEGER,
        label: 'DATA NON DEFINITA',
        items: [...noDate].sort(
          (a, b) => this.deliverySortValue(b) - this.deliverySortValue(a) || a.rif.localeCompare(b.rif, 'it'),
        ),
      });
    }

    return sorted;
  }

  private isoWeek(date: Date): number {
    const dt = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    return Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  private isoWeekYear(date: Date): number {
    const dt = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - day);
    return dt.getUTCFullYear();
  }

  private weekRange(date: Date): { mon: string; sun: string } {
    const dt = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = dt.getUTCDay() || 7;
    const mon = new Date(dt);
    mon.setUTCDate(dt.getUTCDate() - day + 1);
    const sun = new Date(dt);
    sun.setUTCDate(dt.getUTCDate() - day + 7);
    return { mon: this.formatDayMonth(mon), sun: this.formatDayMonth(sun) };
  }

  private formatDayMonth(value: Date): string {
    return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(value);
  }
}
