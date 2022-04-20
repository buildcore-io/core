import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ChartConfiguration, ChartType } from 'chart.js';

@Component({
  selector: 'wen-metrics',
  templateUrl: './metrics.page.html',
  styleUrls: ['./metrics.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MetricsPage {

  
  public colors: string[] = ['rgba(255, 99, 132)', 'rgba(255, 159, 64)', 'rgba(255, 205, 86)', 'rgba(75, 192, 192)', 'rgba(54, 162, 235)', 'rgba(153, 102, 255)'];
  public lineChartType: ChartType = 'doughnut';
  public lineChartData?: ChartConfiguration['data'] = {
    labels: ['Treasury', 'Development fund', 'VC', 'Fundraising', 'Public sale'],
    datasets: [
      {
        label: 'Dataset 1',
        data: [12, 19, 3, 5, 2, 3],
        backgroundColor: this.colors
      }
    ]
  };
  public lineChartOptions?: ChartConfiguration['options'] = {
    events: [],
    plugins: {
      legend: {
        display: false
      }
    }
  };
}
