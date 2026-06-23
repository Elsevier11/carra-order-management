import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ConsegnaStats } from './consegne.types';

const STATUS_ORDER = [
  'IN CORSO',
  'DISEGNO IN GESTIONE',
  'DISEGNO APPROVATO',
  'DA ASSEGNARE',
  'ASSEGNATO',
  'PRONTI & AVVISATI',
  'CONSEGNA PIANIFICATA',
  'CONSEGNA EFFETTUATA',
  'CONCLUSI',
  'SOSPESO',
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
        gap: 6px;
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

      @media (max-width: 900px) {
        .kpi-row { grid-template-columns: repeat(3, 1fr); }
        .charts { grid-template-columns: 1fr; }
        .chart-wrap { height: 170px; }
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
    </div>
  `,
})
export class DashboardChartsComponent {
  @Input({ required: true }) stats!: ConsegnaStats;

  get ritardiPct(): number {
    if (!this.stats.kpi.totaleAttivi) return 0;
    return Math.round((this.stats.kpi.ritardi / this.stats.kpi.totaleAttivi) * 100);
  }

  get pipelineChartData(): ChartConfiguration<'bar'>['data'] {
    const sorted = STATUS_ORDER
      .map((s) => this.stats.pipelineConRitardi.find((r) => r.stato === s))
      .filter(Boolean) as Array<{ stato: string; total: number; late: number }>;

    const extra = this.stats.pipelineConRitardi.filter((r) => !STATUS_ORDER.includes(r.stato));
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
