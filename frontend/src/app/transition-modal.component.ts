import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MittenteDisegno, Operaio, Vettore } from './consegne.types';
import { NoteEditorComponent } from './note-editor.component';
import type { ConsegnaStatus } from '../../../src/shared/order-flow';
import type { DeliveryPlanEntry } from '../../../src/shared/delivery-plan';

export interface TransitionModalModel {
  open: boolean;
  order: { id: number; rif: string } | null;
  fromStatus: ConsegnaStatus | '';
  toStatus: ConsegnaStatus | '';
  disegnoSpeditoAt: string;
  disegnoMittenteId: number | null;
  disegnoApprovatoAt: string;
  massicciataNota: string;
  tipoCariciNota: string;
  lavorazioneAssegnataAt: string;
  consegnaDataEffettiva?: string;
  consegnaDataEffettivaSeconda?: string;
  problemiScaricoNota: string;
  vettoreId?: number | null;
  vettoreSecondoId?: number | null;
  bilici?: number | null;
  biliciSecondi?: number | null;
  operaiIds: number[];
  skipAssegnazione: boolean;
  conclusiMode: 'week' | 'date';
  conclusiWeek: string;
  conclusiDate: string;
  accontoRichiesto: boolean;
  accontoPagato: boolean;
  deliveryPlan: DeliveryPlanEntry[];
  secondaConsegna?: boolean;
  note: string;
  error: string;
}

export interface TransitionConfirmRequest {
  skipAssegnazione: boolean;
}

@Component({
  selector: 'app-transition-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NoteEditorComponent],
  templateUrl: './transition-modal.component.html',
  styleUrl: './transition-modal.component.scss',
})
export class TransitionModalComponent {
  @Input({ required: true }) modal!: TransitionModalModel;
  @Input() mittentiDisegno: MittenteDisegno[] = [];
  @Input() operaiList: Operaio[] = [];
  @Input() vettoriList: Vettore[] = [];
  @Input() pendingTransitionId: number | null = null;

  @Output() confirm = new EventEmitter<TransitionConfirmRequest>();
  @Output() cancel = new EventEmitter<void>();
  @Output() decideLater = new EventEmitter<void>();

  readonly deliveryCountOptions = [1, 2, 3, 4];

  isOperaioSelected(id: number): boolean {
    return this.modal.operaiIds.includes(id);
  }

  toggleOperaio(id: number): void {
    if (!this.modal.open || this.modal.toStatus !== 'ASSEGNATO') return;
    const current = this.modal.operaiIds;
    this.modal.operaiIds = current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id];
  }

  toggleConclusiMode(mode: 'week' | 'date'): void {
    if (!this.modal.open || !['CONCLUSI', 'PRONTI & AVVISATI'].includes(this.modal.toStatus)) return;
    this.modal.conclusiMode = mode;
    if (mode === 'week' && !this.modal.conclusiWeek) {
      this.modal.conclusiWeek = this.todayIsoWeek();
    }
    if (mode === 'date' && !this.modal.conclusiDate) {
      this.modal.conclusiDate = this.todayIsoDate();
    }
  }

  setDeliveryCount(count: number): void {
    if (!this.modal.open || this.modal.toStatus !== 'CONSEGNA PIANIFICATA') return;
    const nextCount = Math.min(Math.max(Math.trunc(Number(count) || 1), 1), 4);
    const plan = [...(this.modal.deliveryPlan ?? [])];
    while (plan.length < nextCount) {
      const previous = plan[plan.length - 1];
      plan.push({
        data: previous?.data || this.todayIsoDate(),
        vettoreId: previous?.vettoreId ?? null,
        bilici: previous?.bilici ?? 0,
      });
    }
    this.modal.deliveryPlan = plan.slice(0, nextCount);
  }

  updateDeliveryPlanEntry(index: number, patch: Partial<DeliveryPlanEntry>): void {
    if (!this.modal.open || this.modal.toStatus !== 'CONSEGNA PIANIFICATA') return;
    const current = this.modal.deliveryPlan[index];
    if (!current) return;
    this.modal.deliveryPlan[index] = {
      data: patch.data ?? current.data,
      vettoreId: patch.vettoreId ?? current.vettoreId,
      bilici: patch.bilici ?? current.bilici,
    };
  }

  deliveryLabel(index: number): string {
    return `${index + 1}a consegna`;
  }

  requestConfirm(skipAssegnazione = false): void {
    this.confirm.emit({ skipAssegnazione });
  }

  openDatePicker(input: HTMLInputElement | null): void {
    if (!input) return;
    const anyInput = input as HTMLInputElement & { showPicker?: () => void };
    try {
      if (typeof anyInput.showPicker === 'function') {
        anyInput.showPicker();
        return;
      }
    } catch {
      // Fallback below.
    }
    input.focus();
    input.click();
  }

  isConfirmDisabled(): boolean {
    return !!this.pendingTransitionId;
  }

  private todayIsoDate(): string {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
  }

  private todayIsoWeek(): string {
    const now = new Date();
    const week = this._isoWeek(now);
    const year = this._isoWeekYear(now);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  private _isoWeek(date: Date): number {
    const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private _isoWeekYear(date: Date): number {
    const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    return tmp.getUTCFullYear();
  }
}
