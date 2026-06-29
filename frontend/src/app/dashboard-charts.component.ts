import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ConsegneService } from './consegne.service';
import { ConsegnaStats, DashboardAgingItem } from './consegne.types';
import { ORDER_STATUS_FLOW } from '../../../src/shared/order-flow';
import type { AppComponent } from './app.component';

type AgingStatus = 'DISEGNO IN GESTIONE' | 'PRONTI & AVVISATI';
type AgingBandKey = 'over30' | 'days15to30' | 'days8to14' | 'days0to7';

type AgingBand = {
  key: AgingBandKey;
  label: string;
  description: string;
  className: string;
  minDays: number;
};

const AGING_BANDS: AgingBand[] = [
  {
    key: 'over30',
    label: 'Oltre 1 mese',
    description: 'Più di 30 giorni',
    className: 'aging-band--overdue',
    minDays: 31,
  },
  {
    key: 'days15to30',
    label: '2-4 settimane',
    description: 'Da 15 a 30 giorni',
    className: 'aging-band--serious',
    minDays: 15,
  },
  {
    key: 'days8to14',
    label: '1-2 settimane',
    description: 'Da 8 a 14 giorni',
    className: 'aging-band--attention',
    minDays: 8,
  },
  {
    key: 'days0to7',
    label: 'Ultimi 7 giorni',
    description: 'Fino a 7 giorni',
    className: 'aging-band--fresh',
    minDays: 0,
  },
];

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
        gap: 12px;
        padding-top: 2px;
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
        gap: 12px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: start;
      }

      .aging-section {
        position: relative;
        background: linear-gradient(180deg, #ffffff 0%, #f8fbfa 100%);
        border: 1px solid #d6e3df;
        border-radius: 16px;
        padding: 12px;
        display: grid;
        gap: 10px;
        align-self: start;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        overflow: hidden;
      }

      .aging-section::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 4px;
        background: #cbd5e1;
      }

      .aging-section--disegno::before {
        background: linear-gradient(180deg, #f59e0b 0%, #fb7185 100%);
      }

      .aging-section--pronti::before {
        background: linear-gradient(180deg, #14b8a6 0%, #2563eb 100%);
      }

      .aging-section__head {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: center;
      }

      .aging-section__head h3 {
        margin: 0;
        font-size: 0.9rem;
        color: #0b1c1c;
        letter-spacing: 0.01em;
      }

      .aging-section__meta {
        font-size: 0.72rem;
        color: #64748b;
      }

      .aging-bands {
        display: grid;
        gap: 8px;
      }

      .aging-band {
        display: grid;
        gap: 8px;
        border: 1px solid #dbe4ee;
        border-radius: 14px;
        padding: 10px;
        background: #fff;
      }

      .aging-band--accordion {
        padding: 0;
        overflow: hidden;
      }

      .aging-band__summary {
        list-style: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px;
        background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      }

      .aging-band__summary::-webkit-details-marker {
        display: none;
      }

      .aging-band__summary:focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }

      .aging-band__summary-chevron {
        flex-shrink: 0;
        width: 30px;
        height: 30px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        color: #1d4ed8;
        font-size: 1.1rem;
        font-weight: 900;
        line-height: 1;
        transition: transform 0.15s ease;
      }

      .aging-band--accordion[open] .aging-band__summary-chevron {
        transform: rotate(90deg);
      }

      .aging-band__body {
        display: grid;
        gap: 8px;
        padding: 0 10px 10px;
      }

      .aging-band__head {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: center;
      }

      .aging-band__title {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .aging-band__label {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        padding: 3px 8px;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.01em;
      }

      .aging-band__description {
        font-size: 0.74rem;
        color: #64748b;
      }

      .aging-band__count {
        font-size: 0.72rem;
        font-weight: 700;
        color: #334155;
        white-space: nowrap;
      }

      .aging-band__summary-action {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid #bfdbfe;
        background: #eff6ff;
        color: #1d4ed8;
        font-size: 0.72rem;
        font-weight: 800;
        white-space: nowrap;
      }

      .aging-band--overdue .aging-band__label {
        background: #fef2f2;
        color: #b91c1c;
      }

      .aging-band--serious .aging-band__label {
        background: #fff7ed;
        color: #c2410c;
      }

      .aging-band--attention .aging-band__label {
        background: #eff6ff;
        color: #1d4ed8;
      }

      .aging-band--fresh .aging-band__label {
        background: #ecfdf3;
        color: #166534;
      }

      .aging-list {
        display: grid;
        gap: 8px;
        max-height: 320px;
        overflow: auto;
        padding-right: 4px;
      }

      .aging-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        gap: 12px;
        align-items: center;
        border: 1px solid #dbe4ee;
        border-radius: 12px;
        padding: 9px 10px;
        background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
        box-shadow: 0 1px 1px rgba(15, 23, 42, 0.03);
      }

      .aging-row:hover {
        border-color: #b8c8da;
        background: #ffffff;
      }

      .aging-row__main {
        display: grid;
        gap: 3px;
        min-width: 0;
      }

      .aging-row__ref {
        font-weight: 800;
        color: #0f172a;
        font-size: 0.9rem;
      }

      .aging-row__cliente {
        font-size: 0.8rem;
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
        font-size: 0.74rem;
        color: #475569;
      }

      .aging-pill {
        display: inline-flex;
        width: fit-content;
        align-items: center;
        border-radius: 999px;
        border: 1px solid transparent;
        padding: 2px 7px;
        font-size: 0.7rem;
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

      .aging-empty,
      .aging-error {
        color: #64748b;
        font-size: 0.82rem;
        padding: 4px 0;
      }

      .aging-error {
        color: #b91c1c;
      }

      .aging-panel__count {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 9px;
        border-radius: 999px;
        background: #eef6ff;
        color: #1d4ed8;
        border: 1px solid #dbeafe;
        font-size: 0.72rem;
        font-weight: 700;
      }

      .aging-empty {
        border: 1px dashed #cbd5e1;
        border-radius: 12px;
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      }

      @media (max-width: 900px) {
        .kpi-row { grid-template-columns: repeat(3, 1fr); }
        .charts { grid-template-columns: 1fr; }
        .chart-wrap { height: 170px; }
        .aging-grid { grid-template-columns: 1fr; }
        .aging-row { grid-template-columns: 1fr; }
        .aging-row__meta { justify-items: start; text-align: left; }
        .aging-list { max-height: none; }
        .aging-band__head { align-items: flex-start; flex-direction: column; }
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
            <p>Solo gli ordini fermi in <strong>DISEGNO IN GESTIONE</strong> e <strong>PRONTI & AVVISATI</strong>, con accesso rapido ai casi da sbloccare.</p>
          </div>
          <button type="button" class="ghost" (click)="reloadAging()">Aggiorna elenco</button>
        </div>

        @if (agingLoading) {
          <div class="aging-empty">Caricamento ordini da riprendere...</div>
        } @else if (agingError) {
          <div class="aging-error">{{ agingError }}</div>
        } @else {
          <div class="aging-grid">
            @for (status of agingStatuses; track status) {
              <article class="aging-section" [class.aging-section--disegno]="status === 'DISEGNO IN GESTIONE'" [class.aging-section--pronti]="status === 'PRONTI & AVVISATI'">
                <div class="aging-section__head">
                  <div>
                    <h3>{{ status }}</h3>
                    <div class="aging-section__meta">{{ agingRowsByStatus(status).length }} ordini</div>
                  </div>
                </div>

                @if (agingRowsByStatus(status).length) {
                  <div class="aging-bands">
                    @for (band of agingBandsByStatus(status); track band.key) {
                      @if (shouldUseAccordion(band.rows.length)) {
                        <details class="aging-band aging-band--accordion" [ngClass]="band.className" [open]="band.key === 'over30'">
                          <summary class="aging-band__summary">
                          <div class="aging-band__title">
                            <span class="aging-band__label">{{ band.label }}</span>
                            <span class="aging-band__description">{{ band.description }}</span>
                          </div>
                          <span class="aging-band__summary-action">Apri lista</span>
                          <div class="aging-band__count">{{ band.rows.length }} ordini</div>
                          <span class="aging-band__summary-chevron">›</span>
                        </summary>
                          <div class="aging-band__body">
                            <div class="aging-list">
                              @for (item of band.rows; track item.id) {
                                <div class="aging-row">
                                  <div class="aging-row__main">
                                    <div class="aging-row__ref">{{ item.rif }}</div>
                                    <div class="aging-row__cliente">{{ item.cliente }}</div>
                                  </div>
                                  <div class="aging-row__meta">
                                    <span class="aging-pill" [ngClass]="agingDaysClass(item.daysInState)">{{ item.daysInState }} giorni</span>
                                    <span>{{ item.disegnoApprovatoAt ? 'Approvazione' : 'Ingresso' }}: {{ formatAgingDate(item.disegnoApprovatoAt || item.enteredAt) }}</span>
                                  </div>
                                  <button type="button" class="ghost" (click)="openAgingItem(item)">Apri</button>
                                </div>
                              }
                            </div>
                          </div>
                        </details>
                      } @else {
                        <div class="aging-band" [ngClass]="band.className">
                          <div class="aging-band__head">
                            <div class="aging-band__title">
                              <span class="aging-band__label">{{ band.label }}</span>
                              <span class="aging-band__description">{{ band.description }}</span>
                            </div>
                            <div class="aging-band__count">{{ band.rows.length }} ordini</div>
                          </div>
                          <div class="aging-list">
                            @for (item of band.rows; track item.id) {
                              <div class="aging-row">
                                <div class="aging-row__main">
                                  <div class="aging-row__ref">{{ item.rif }}</div>
                                  <div class="aging-row__cliente">{{ item.cliente }}</div>
                                </div>
                                <div class="aging-row__meta">
                                  <span class="aging-pill" [ngClass]="agingDaysClass(item.daysInState)">{{ item.daysInState }} giorni</span>
                                  <span>{{ item.disegnoApprovatoAt ? 'Approvazione' : 'Ingresso' }}: {{ formatAgingDate(item.disegnoApprovatoAt || item.enteredAt) }}</span>
                                </div>
                                <button type="button" class="ghost" (click)="openAgingItem(item)">Apri</button>
                              </div>
                            }
                          </div>
                        </div>
                      }
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
  @Input({ required: true }) app!: AppComponent;

  agingLoading = false;
  agingError = '';
  agingRows: DashboardAgingItem[] = [];
  readonly agingStatuses: AgingStatus[] = ['DISEGNO IN GESTIONE', 'PRONTI & AVVISATI'];

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

  agingBandsByStatus(status: AgingStatus): Array<AgingBand & { rows: DashboardAgingItem[] }> {
    const rows = this.agingRowsByStatus(status);
    return AGING_BANDS.map((band) => ({
      ...band,
      rows: rows.filter((row) => this.agingBandKey(row.daysInState) === band.key),
    })).filter((band) => band.rows.length > 0);
  }

  shouldUseAccordion(rowCount: number): boolean {
    return rowCount > 3;
  }

  openAgingItem(item: DashboardAgingItem): void {
    this.app.openOrderFromDashboard(item);
  }

  private agingBandKey(daysInState: number): AgingBandKey {
    if (daysInState >= 31) return 'over30';
    if (daysInState >= 15) return 'days15to30';
    if (daysInState >= 8) return 'days8to14';
    return 'days0to7';
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
