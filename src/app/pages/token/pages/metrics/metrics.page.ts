import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { DescriptionItem } from '@components/description/description.component';
import { Token, TokenAllocation } from '@functions/interfaces/models/token';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from '@pages/token/services/data.service';
import { ChartConfiguration, ChartType } from 'chart.js';


@UntilDestroy()
@Component({
  selector: 'wen-metrics',
  templateUrl: './metrics.page.html',
  styleUrls: ['./metrics.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MetricsPage implements OnInit {
  public colors: string[] = [];
  public lineChartType: ChartType = 'doughnut';
  public lineChartData?: ChartConfiguration['data'] = {
    datasets: []
  };
  public lineChartOptions?: ChartConfiguration['options'] = {
    events: [],
    plugins: {
      legend: {
        display: false
      }
    }
  };
  public breakdownData: DescriptionItem[] = [];

  constructor(
    public data: DataService,
    private cd: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    this.data.token$
      .pipe(untilDestroyed(this))
      .subscribe(token => {
        this.breakdownData = [
          { title: $localize`Totak token supply`, value: token?.totalSupply },
          { title: $localize`Price per token`, value: this.data.formatBest(token?.pricePerToken) },
          ...(token?.allocations || []).map(a => ({ title: a.title, value: a.percentage + '%', extraValue: `(${this.data.percentageMarketCap(a.percentage, token)})` }))
        ];
        this.setLineChartData(token);
        this.cd.markForCheck();
      });
  }

  public setLineChartData(token?: Token): void {
    if (!token) return;
    this.colors = token.allocations.map(() => "#" + ((1<<24)*Math.random() | 0).toString(16));
    this.lineChartData = {
      labels: token.allocations.map(a => a.title),
      datasets: [
        {
          label: 'Dataset 1',
          data: token.allocations.map(a => Number(a.percentage)),
          backgroundColor: this.colors
        }
      ]
    };
    this.cd.markForCheck();
  }

  public percentageTokenAmount(a: TokenAllocation, token?: Token): string {
    if (!token) return '';
    return this.data.formatBest(Math.floor(token.totalSupply * Number(a.percentage) / 100), token.symbol);
  }
}
