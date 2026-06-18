import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ConsegnaStats } from './consegne.types';

const STATUS_ORDER = [
  'IN CORSO',
  'DISEGNO IN GESTIONE',
  'IN LAVORAZIONE',
  'PRONTI & AVVISATI',
  'CONSEGNA PIANIFICATA',
  'SOSPESO',
];

@Component({
  selector: 'app-dashboard-charts',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  providers: [provideCharts(withDefaultRegisterables())],
  styles: [
    `
      .kpi-row {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 12px;
        margin-bottom: 20px;
      }

      .kpi-card {
        background: #ffffff;
        border: 1px solid #c6d9d3;
        border-radius: 12px;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .kpi-value {
        font-size: 2rem;
        font-weight: 800;
        color: #0b1c1c;
        line-height: 1;
      }

      .kpi-label {
        font-size: 0.78rem;
        color: #6b7280;
        line-height: 1.3;
      }

      .kpi-label small {
        display: block;
        font-size: 0.7rem;
        margin-top: 2px;
        color: #9ca3af;
      }

      .kpi-card--warn .kpi-value { color: #b45309; }
      .kpi-card--danger .kpi-value { color: #991b1b; }

      .charts {
        display: grid;
        gap: 12px;
        grid-template-columns: 1fr 1fr;
      }

      .chart-card {
        background: #ffffff;
        border: 1px solid #c6d9d3;
        border-radius: 14px;
        padding: 14px;
      }

      .chart-card.full {
        grid-column: 1 / -1;
      }

      .chart-card h2 {
        margin: 0 0 12px;
        font-size: 1rem;
        color: #0b1c1c;
      }

      .chart-wrap {
        height: 240px;
      }

      .chart-wrap--tall {
        height: 320px;
      }

      @media (max-width: 900px) {
        .kpi-row { grid-template-columns: repeat(3, 1fr); }
        .charts { grid-template-columns: 1fr; }
      }
    `,
  ],
  template: `
    <!-- KPI Cards -->
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
      <div class="kpi-card" [class.kpi-card--warn]="stats.kpi.accontiDaIncassare > 0">
        <span class="kpi-value">{{ stats.kpi.accontiDaIncassare }}</span>
        <span class="kpi-label">Acconti da incassare</span>
      </div>
    </div>

    <section class="charts">
      <!-- Pipeline per stato (full width) -->
      <article class="chart-card full">
        <h2>Pipeline ordini — in tempo vs in ritardo per stato</h2>
        <div class="chart-wrap chart-wrap--tall">
          <canvas baseChart [data]="pipelineChartData" [options]="pipelineOptions" [type]="'bar'"></canvas>
        </div>
      </article>

      <!-- Carico prossime 8 settimane -->
      <article class="chart-card">
        <h2>Carico consegne — prossime 8 settimane</h2>
        <div class="chart-wrap">
          <canvas baseChart [data]="upcomingChartData" [options]="upcomingOptions" [type]="'bar'"></canvas>
        </div>
      </article>

      <!-- Top clienti (full width) -->
      <article class="chart-card full">
        <h2>Top clienti — ordini attivi</h2>
        <div class="chart-wrap chart-wrap--tall">
          <canvas baseChart [data]="clientiChartData" [options]="clientiOptions" [type]="'bar'"></canvas>
        </div>
      </article>
    </section>
  `,
})
export class DashboardChartsComponent {
  @Input({ required: true }) stats!: ConsegnaStats;

  get ritardiPct(): number {
    if (!this.stats.kpi.totaleAttivi) return 0;
    return Math.round((this.stats.kpi.ritardi / this.stats.kpi.totaleAttivi) * 100);
  }

  // Pipeline: horizontal stacked bar (in tempo + in ritardo per stato)
  get pipelineChartData(): ChartConfiguration<'bar'>['data'] {
    const sorted = STATUS_ORDER
      .map((s) => this.stats.pipelineConRitardi.find((r) => r.stato === s))
      .filter(Boolean) as Array<{ stato: string; total: number; late: number }>;

    // Includi stati extra non nel flow standard
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

  // Carico prossime 8 settimane
  get upcomingChartData(): ChartConfiguration<'bar'>['data'] {
    return {
      labels: this.stats.upcomingByWeek.map((r) => 'Sett ' + r.week.split('-')[1]),
      datasets: [
        {
          label: 'Consegne programmate',
          data: this.stats.upcomingByWeek.map((r) => Number(r.count)),
          backgroundColor: '#93c5fd',
          borderRadius: 4,
        },
      ],
    };
  }

  readonly upcomingOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { ticks: { stepSize: 1 }, beginAtZero: true },
    },
  };

  // Top clienti: horizontal bar
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
