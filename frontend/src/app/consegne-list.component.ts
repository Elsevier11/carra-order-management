import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { buildDeliveryPlanFromLegacy, normalizeDeliveryPlanEntries } from '../../../src/shared/delivery-plan';
import type { ConsegnaRecord } from './consegne.types';
import type { KanbanBoardHost } from './kanban-board.component';

interface WeekGroup {
  key: number;
  label: string;
  items: ConsegnaRecord[];
}

interface MonthGroup {
  key: number;
  label: string;
  items: ConsegnaRecord[];
  expanded: boolean;
}

type ConsegneMode = 'planned' | 'performed';

@Component({
  selector: 'app-consegne-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consegne-list.component.html',
  styleUrl: './consegne-list.component.scss',
})
export class ConsegneListComponent {
  @Input({ required: true }) app!: KanbanBoardHost;
  @Input() mode: ConsegneMode = 'planned';
  readonly currentMonthKey = this.monthKey(new Date());
  private readonly monthExpandedState = new Map<number, boolean>();
  private monthAccordionTouched = false;

  get section(): { status: string; label: string; subtitle: string } {
    if (this.mode === 'performed') {
      return {
        status: 'CONSEGNA EFFETTUATA',
        label: 'Consegne Effettuate',
        subtitle: 'Raggruppamento settimanale sulla data di consegna effettiva.',
      };
    }
    return {
      status: 'CONSEGNA PIANIFICATA',
      label: 'Consegne Pianificate',
      subtitle: 'Raggruppamento settimanale sulla data di consegna pianificata.',
    };
  }

  sectionItems(): ConsegnaRecord[] {
    const items = this.app.filteredKanbanItems(this.itemsForStatus(this.section.status));
    return [...items].sort((a, b) => this.deliverySortValue(b) - this.deliverySortValue(a) || a.rif.localeCompare(b.rif, 'it'));
  }

  sectionWeekGroups(): WeekGroup[] {
    return this.buildWeekGroups(this.sectionItems());
  }

  sectionMonthGroups(): MonthGroup[] {
    return this.buildMonthGroups(this.sectionItems());
  }

  toggleMonthGroup(group: MonthGroup): void {
    this.monthAccordionTouched = true;
    const nextState = !this.monthExpandedState.get(group.key);
    this.monthExpandedState.clear();
    if (nextState) {
      this.monthExpandedState.set(group.key, true);
    }
  }

  deliveryDateLabel(item: ConsegnaRecord): string {
    const entries = this.deliveryEntries(item);
    if (!entries.length) return '—';
    return entries
      .map((entry, index) => {
        const value = this.formatDate(entry.data);
        return index < entries.length - 1 ? `${value} +` : value;
      })
      .join('\n');
  }

  biliciLabel(item: ConsegnaRecord): string {
    const entries = this.deliveryEntries(item);
    if (!entries.length) return `${item.bilici}`;
    const labels = entries
      .map((entry) => (entry.bilici != null ? `${entry.bilici}` : ''))
      .filter(Boolean);
    return labels.length ? labels.join(' + ') : `${item.bilici}`;
  }

  vettoreLabel(item: ConsegnaRecord): string {
    const entries = this.deliveryEntries(item);
    if (!entries.length) return this.app.nomeVettore(item.vettoreId);
    const labels = entries
      .map((entry) => {
        const value = this.app.nomeVettore(entry.vettoreId);
        return value && value !== '—' ? value : '';
      })
      .filter(Boolean);
    return labels.length ? labels.join(' + ') : this.app.nomeVettore(item.vettoreId);
  }

  private itemsForStatus(status: string): ConsegnaRecord[] {
    return this.app.boardColumns.find((column) => column.status === status)?.items ?? [];
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
    const value = item.consegnaDataEffettiva;
    if (!value) return Number.NEGATIVE_INFINITY;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? Number.NEGATIVE_INFINITY : parsed.getTime();
  }

  private buildWeekGroups(items: ConsegnaRecord[]): WeekGroup[] {
    const groups = new Map<number, WeekGroup>();
    const noDate: ConsegnaRecord[] = [];

    for (const item of items) {
      const value = item.consegnaDataEffettiva;
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
          label: `SETT. ${String(week).padStart(2, '0')} - DAL ${mon} AL ${sun}`,
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
      .sort((a, b) => b.key - a.key);

    if (noDate.length) {
      sorted.push({
        key: Number.MIN_SAFE_INTEGER,
        label: 'DATA NON DEFINITA',
        items: [...noDate].sort(
          (a, b) => this.deliverySortValue(b) - this.deliverySortValue(a) || a.rif.localeCompare(b.rif, 'it'),
        ),
      });
    }

    return sorted;
  }

  private buildMonthGroups(items: ConsegnaRecord[]): MonthGroup[] {
    const groups = new Map<number, MonthGroup>();
    const noDate: ConsegnaRecord[] = [];

    for (const item of items) {
      const value = item.consegnaDataEffettiva;
      if (!value) {
        noDate.push(item);
        continue;
      }

      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        noDate.push(item);
        continue;
      }

      const key = this.monthKey(parsed);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: this.monthLabel(parsed),
          items: [],
          expanded: this.monthExpandedState.has(key)
            ? this.monthExpandedState.get(key) === true
            : !this.monthAccordionTouched && key === this.currentMonthKey,
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
      .sort((a, b) => b.key - a.key);

    if (noDate.length) {
      sorted.push({
        key: Number.MIN_SAFE_INTEGER,
        label: 'DATA NON DEFINITA',
        items: [...noDate].sort(
          (a, b) => this.deliverySortValue(b) - this.deliverySortValue(a) || a.rif.localeCompare(b.rif, 'it'),
        ),
        expanded: false,
      });
    }

    for (const group of sorted) {
      if (!this.monthExpandedState.has(group.key)) {
        this.monthExpandedState.set(group.key, group.expanded);
      } else {
        group.expanded = this.monthExpandedState.get(group.key) === true;
      }
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

  private monthKey(date: Date): number {
    return date.getUTCFullYear() * 100 + (date.getUTCMonth() + 1);
  }

  private monthLabel(date: Date): string {
    return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(date)
      .toUpperCase();
  }
}
