import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ConsegneService } from './consegne.service';
import { ConsegnaStats, DashboardAgingItem } from './consegne.types';
import { ORDER_STATUS_FLOW } from '../../../src/shared/order-flow';

type AgingStatus = 'DISEGNO IN GESTIONE' | 'PRONTI & AVVISATI';

@Component({
  selector: 'app-dashboard-charts',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  providers: [provideCharts(withDefaultRegisterables())],
  styles: [
    `
      .dashboard-shell {
        display: grid;
        gap: 12px;
      }

      .kpi-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 6px;
      }

      .kpi-card {
        background: #ffffff;
        border: 1px solid #c6d9d3;
        border-radius: 12px;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 0;
      }

      .kpi-value {
        font-size: 1.25rem;
        font-weight: 800;
        color: #0b1c1c;
        line-height: 1;
      }

      .kpi-label {
        font-size: 0.66rem;
        color: #6b7280;
        line-height: 1.3;
      }

      .kpi-label small {
        display: block;
        font-size: 0.6rem;
        margin-top: 0;
        color: #9ca3af;
      }

      .kpi-card--warn .kpi-value { color: #b45309; }
      .kpi-card--danger .kpi-value { color: #991b1b; }

      .charts {
        display: grid;
        gap: 6px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        align-items: stretch;
      }

      .chart-card {
        background: #ffffff;
        border: 1px solid #c6d9d3;
        border-radius: 14px;
        padding: 8px 10px;
        min-width: 0;
        display: grid;
        gap: 6px;
        grid-template-rows: auto auto 1fr;
        height: 100%;
      }

      .chart-card__eyebrow {
        display: inline-flex;
        width: fit-content;
        padding: 3px 8px;
        border-radius: 999px;
        border: 1px solid #d8e7e3;
        background: #f8fbfa;
        color: #0b1c1c;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .chart-card h2 {
        margin: 0;
        font-size: 0.84rem;
        color: #0b1c1c;
      }

      .chart-wrap {
        height: 138px;
      }

      .aging-panel {
        display: grid;
        gap: 10px;
      }

      .aging-panel__header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 8px;
        align-items: end;
      }

      .aging-panel__header h2 {
        margin: 0;
        font-size: 1rem;
        color: #0b1c1c;
      }

      .aging-panel__header p {
        margin: 0;
        color: #64748b;
        font-size: 0.8rem;
      }

      .aging-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .aging-section {
        background: #ffffff;
        border: 1px solid #c6d9d3;
        border-radius: 14px;
        padding: 10px;
        display: grid;
        gap: 8px;
      }

      .aging-section__head {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: center;
      }

      .aging-section__head h3 {
        margin: 0;
        font-size: 0.92rem;
        color: #0b1c1c;
      }

      .aging-section__meta {
        font-size: 0.72rem;
        color: #64748b;
      }

      .aging-list {
        display: grid;
        gap: 6px;
      }

      .aging-row {
        display: grid;
        grid-template-columns: auto 1fr auto auto;
        gap: 8px;
        align-items: center;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 8px 10px;
        background: #fbfdff;
      }

      .aging-row__check {
        display: inline-flex;
        align-items: center;
      }

      .aging-row__main {
        display: grid;
        gap: 2px;
        min-width: 0;
      }

      .aging-row__ref {
        font-weight: 800;
        color: #0b1c1c;
      }

      .aging-row__cliente {
        font-size: 0.82rem;
        color: #475569;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .aging-row__meta {
        display: grid;
        gap: 2px;
        justify-items: end;
        text-align: right;
        font-size: 0.75rem;
        color: #64748b;
      }

      .aging-pill {
        display: inline-flex;
        width: fit-content;
        align-items: center;
        border-radius: 999px;
        border: 1px solid transparent;
        padding: 2px 8px;
        font-size: 0.72rem;
        font-weight: 700;
      }

      .aging-pill--green {
        background: #ecfdf3;
        border-color: #bbf7d0;
        color: #166534;
      }

      .aging-pill--amber {
        background: #fff7ed;
        border-color: #fed7aa;
        color: #9a3412;
      }

      .aging-pill--red {
        background: #fef2f2;
        border-color: #fecaca;
        color: #991b1b;
      }

      .aging-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .aging-actions button {
        white-space: nowrap;
      }

      .aging-empty,
      .aging-error {
        color: #64748b;
        font-size: 0.82rem;
        padding: 4px 0;
      }

      .aging-error {
        color: #b91c1c;
      }

      @media (max-width: 900px) {
        .kpi-row { grid-template-columns: repeat(3, 1fr); }
        .charts { grid-template-columns: 1fr; }
        .chart-wrap { height: 170px; }
        .aging-grid { grid-template-columns: 1fr; }
        .aging-row { grid-template-columns: auto 1fr; }
        .aging-row__meta { justify-items: start; text-align: left; }
      }
    `,
  ],
  template: `
    <div class="dashboard-shell">
      <div class="kpi-row">
        <div class="kpi-card">
          <span class="kpi-value">{{ stats.kpi.totaleAttivi }}</span>
          <span class="kpi-label">Ordini attivi</span>
        </div>
        <div class="kpi-card" [class.kpi-card--warn]="ritardiPct > 10" [class.kpi-card--danger]="ritardiPct > 25">
          <span class="kpi-value">{{ stats.kpi.ritardi }}</span>
          <span class="kpi-label">
            Ritardi
            <small>{{ ritardiPct }}% degli attivi</small>
          </span>
        </div>
        <div class="kpi-card">
          <span class="kpi-value">{{ stats.kpi.consegneSettimanaCorrente }}</span>
          <span class="kpi-label">Consegne questa settimana</span>
        </div>
        <div class="kpi-card" [class.kpi-card--warn]="stats.kpi.consegneProssimaSettimana > 10">
          <span class="kpi-value">{{ stats.kpi.consegneProssimaSettimana }}</span>
          <span class="kpi-label">Consegne settimana prossima</span>
        </div>
        <div class="kpi-card" [class.kpi-card--warn]="stats.kpi.ordiniIncompleti > 0">
          <span class="kpi-value">{{ stats.kpi.ordiniIncompleti }}</span>
          <span class="kpi-label">
            Ordini incompleti
            <small>resp. o documenti mancanti</small>
          </span>
        </div>
        <div class="kpi-card" [class.kpi-card--warn]="stats.kpi.accontiDaIncassare > 0">
          <span class="kpi-value">{{ stats.kpi.accontiDaIncassare }}</span>
          <span class="kpi-label">Acconti da incassare</span>
        </div>
      </div>

      <section class="charts">
        <article class="chart-card">
          <span class="chart-card__eyebrow">Flusso</span>
          <h2>Pipeline ordini - in tempo vs in ritardo per stato</h2>
          <div class="chart-wrap">
            <canvas baseChart [data]="pipelineChartData" [options]="pipelineOptions" [type]="'bar'"></canvas>
          </div>
        </article>

        <article class="chart-card">
          <span class="chart-card__eyebrow">Tempo</span>
          <h2>Andamento ordini - ultime 8 settimane</h2>
          <div class="chart-wrap">
            <canvas baseChart [data]="trendChartData" [options]="trendOptions" [type]="'line'"></canvas>
          </div>
        </article>

        <article class="chart-card">
          <span class="chart-card__eyebrow">Clienti</span>
          <h2>Top clienti - ordini attivi</h2>
          <div class="chart-wrap">
            <canvas baseChart [data]="clientiChartData" [options]="clientiOptions" [type]="'bar'"></canvas>
          </div>
        </article>
      </section>

      <section class="aging-panel">
        <div class="aging-panel__header">
          <div>
            <h2>Ordini da riprendere</h2>
            <p>Solo gli ordini fermi in <strong>DISEGNO IN GESTIONE</strong> e <strong>PRONTI & AVVISATI</strong>.</p>
          </div>
          <div class="aging-actions">
            <button type="button" class="ghost" (click)="reloadAging()">Aggiorna elenco</button>
          </div>
        </div>

        @if (agingLoading) {
          <div class="aging-empty">Caricamento ordini da riprendere...</div>
        } @else if (agingError) {
          <div class="aging-error">{{ agingError }}</div>
        } @else {
          <div class="aging-grid">
            @for (status of agingStatuses; track status) {
              <article class="aging-section">
                <div class="aging-section__head">
                  <div>
                    <h3>{{ status }}</h3>
                    <div class="aging-section__meta">{{ agingRowsByStatus(status).length }} ordini</div>
                  </div>
                  <button type="button" class="ghost" [disabled]="!selectedAgingRowsByStatus(status).length" (click)="openFirstSelected(status)">
                    Apri selezionato
                  </button>
                </div>

                @if (agingRowsByStatus(status).length) {
                  <div class="aging-list">
                    @for (item of agingRowsByStatus(status); track item.id) {
                      <div class="aging-row">
                        <label class="aging-row__check">
                          <input type="checkbox" [checked]="isAgingSelected(item.id)" (change)="toggleAgingSelection(item.id)" />
                        </label>
                        <div class="aging-row__main">
                          <div class="aging-row__ref">{{ item.rif }}</div>
                          <div class="aging-row__cliente">{{ item.cliente }}</div>
                        </div>
                        <div class="aging-row__meta">
                          <span class="aging-pill" [ngClass]="agingDaysClass(item.daysInState)">{{ item.daysInState }} giorni</span>
                          <span>Ingresso: {{ formatAgingDate(item.enteredAt) }}</span>
                        </div>
                        <button type="button" class="ghost" (click)="openAgingItem(item)">Apri</button>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="aging-empty">Nessun ordine in questo stato.</div>
                }
              </article>
            }
          </div>
        }
      </section>
    </div>
  `,
})
export class DashboardChartsComponent implements OnInit {
  private readonly consegneService = inject(ConsegneService);

  @Input({ required: true }) stats!: ConsegnaStats;
  @Input({ required: true }) app!: any;

  agingLoading = false;
  agingError = '';
  agingRows: DashboardAgingItem[] = [];
  readonly agingStatuses: AgingStatus[] = ['DISEGNO IN GESTIONE', 'PRONTI & AVVISATI'];
  private readonly agingSelectedIds = new Set<number>();

  ngOnInit(): void {
    this.loadAging();
  }

  reloadAging(): void {
    this.loadAging();
  }

  private loadAging(): void {
    this.agingLoading = true;
    this.agingError = '';
    this.consegneService.dashboardAging().subscribe({
      next: (response) => {
        this.agingRows = [...response.data].sort((a, b) => b.daysInState - a.daysInState || (a.enteredAt ?? '').localeCompare(b.enteredAt ?? ''));
        this.agingLoading = false;
      },
      error: (error) => {
        this.agingRows = [];
        this.agingError = error?.error?.message ?? 'Impossibile caricare gli ordini da riprendere';
        this.agingLoading = false;
      },
    });
  }

  get ritardiPct(): number {
    if (!this.stats.kpi.totaleAttivi) return 0;
    return Math.round((this.stats.kpi.ritardi / this.stats.kpi.totaleAttivi) * 100);
  }

  agingRowsByStatus(status: AgingStatus): DashboardAgingItem[] {
    return this.agingRows.filter((row) => row.stato === status);
  }

  isAgingSelected(id: number): boolean {
    return this.agingSelectedIds.has(id);
  }

  toggleAgingSelection(id: number): void {
    if (this.agingSelectedIds.has(id)) {
      this.agingSelectedIds.delete(id);
      return;
    }
    this.agingSelectedIds.add(id);
  }

  selectedAgingRowsByStatus(status: AgingStatus): DashboardAgingItem[] {
    return this.agingRowsByStatus(status).filter((row) => this.agingSelectedIds.has(row.id));
  }

  openFirstSelected(status: AgingStatus): void {
    const row = this.selectedAgingRowsByStatus(status)[0];
    if (!row) return;
    this.openAgingItem(row);
  }

  openAgingItem(item: DashboardAgingItem): void {
    this.app.openOrderFromDashboard(item);
  }

  agingDaysClass(daysInState: number): string {
    if (daysInState >= 7) return 'aging-pill aging-pill--red';
    if (daysInState >= 3) return 'aging-pill aging-pill--amber';
    return 'aging-pill aging-pill--green';
  }

  formatAgingDate(value: string | null): string {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('it-IT');
  }

  get pipelineChartData(): ChartConfiguration<'bar'>['data'] {
    const sorted = ORDER_STATUS_FLOW
      .map((s) => this.stats.pipelineConRitardi.find((r) => r.stato === s))
      .filter(Boolean) as Array<{ stato: string; total: number; late: number }>;

    const extra = this.stats.pipelineConRitardi.filter((r) => !ORDER_STATUS_FLOW.includes(r.stato as (typeof ORDER_STATUS_FLOW)[number]));
    const all = [...sorted, ...extra];

    return {
      labels: all.map((r) => r.stato),
      datasets: [
        {
          label: 'In tempo',
          data: all.map((r) => r.total - r.late),
          backgroundColor: '#86efac',
          borderRadius: 4,
        },
        {
          label: 'In ritardo',
          data: all.map((r) => r.late),
          backgroundColor: '#fca5a5',
          borderRadius: 4,
        },
      ],
    };
  }

  readonly pipelineOptions: ChartConfiguration<'bar'>['options'] = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { stepSize: 1 } },
      y: { stacked: true, grid: { display: false } },
    },
  };

  get trendChartData(): ChartConfiguration<'line'>['data'] {
    return {
      labels: this.stats.weeklyTrend.map((r) => `Sett ${r.week.split('-')[1] ?? r.week}`),
      datasets: [
        {
          label: 'Ordini',
          data: this.stats.weeklyTrend.map((r) => Number(r.count)),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.18)',
          tension: 0.3,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 4,
        },
      ],
    };
  }

  readonly trendOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  get clientiChartData(): ChartConfiguration<'bar'>['data'] {
    return {
      labels: this.stats.byClienteAttivi.map((r) => r.cliente),
      datasets: [
        {
          label: 'Ordini attivi',
          data: this.stats.byClienteAttivi.map((r) => r.count),
          backgroundColor: '#a5b4fc',
          borderRadius: 4,
        },
      ],
    };
  }

  readonly clientiOptions: ChartConfiguration<'bar'>['options'] = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { stepSize: 1 } },
      y: { grid: { display: false } },
    },
  };
}
