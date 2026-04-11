import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ConsegnaStats } from './consegne.types';

@Component({
  selector: 'app-dashboard-charts',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  providers: [provideCharts(withDefaultRegisterables())],
  styles: [
    `
      .charts {
        margin-top: 20px;
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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
    `,
  ],
  template: `
    <section class="charts">
      <article class="chart-card">
        <h2>Consegne per Vettore</h2>
        <div class="chart-wrap">
          <canvas baseChart [data]="carrierChartData" [options]="carrierChartOptions" [type]="'bar'"></canvas>
        </div>
      </article>
      <article class="chart-card">
        <h2>Distribuzione Stati</h2>
        <div class="chart-wrap">
          <canvas baseChart [data]="statusChartData" [options]="statusChartOptions" [type]="'doughnut'"></canvas>
        </div>
      </article>
      <article class="chart-card full">
        <h2>Trend Settimanale</h2>
        <div class="chart-wrap">
          <canvas baseChart [data]="trendChartData" [options]="trendChartOptions" [type]="'line'"></canvas>
        </div>
      </article>
    </section>
  `,
})
export class DashboardChartsComponent {
  @Input({ required: true }) stats!: ConsegnaStats;

  get carrierChartData(): ChartConfiguration<'bar'>['data'] {
    return {
      labels: this.stats.byCarrier.map((item) => item.vettore),
      datasets: [{ data: this.stats.byCarrier.map((item) => Number(item.count)), label: 'Consegne per vettore', backgroundColor: '#0f766e' }],
    };
  }

  get statusChartData(): ChartConfiguration<'doughnut'>['data'] {
    return {
      labels: this.stats.byStatus.map((item) => item.stato),
      datasets: [{ data: this.stats.byStatus.map((item) => Number(item.count)), backgroundColor: ['#14532d', '#f59e0b', '#b91c1c', '#0ea5e9', '#6d28d9'] }],
    };
  }

  get trendChartData(): ChartConfiguration<'line'>['data'] {
    return {
      labels: this.stats.weeklyTrend.map((item) => item.week),
      datasets: [
        {
          label: 'Trend settimanale',
          data: this.stats.weeklyTrend.map((item) => Number(item.count)),
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14,165,233,0.2)',
          fill: true,
        },
      ],
    };
  }

  carrierChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  };

  statusChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
  };

  trendChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  };
}
