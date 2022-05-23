import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { DescriptionItem } from '@components/description/description.component';
import { getRandomColor, INITIAL_COLORS } from '@core/utils/colors.utils';
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
  public lineChartOptions?: any = {
    events: [],
    plugins: {
      legend: {
        display: false
      }
    },
    elements: {
      arc: {
        borderWidth: 0
      }
    },
    cutout: '75%'
  };
  public breakdownData: DescriptionItem[] = [];

  constructor(
    public data: DataService,
    private decimalPipe: DecimalPipe,
    private cd: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    this.data.token$
      .pipe(untilDestroyed(this))
      .subscribe(token => {
        this.breakdownData = [
          { title: $localize`Total token supply (Initial market cap)`, value: this.decimalPipe.transform(this.data.formatTokenBest(token?.totalSupply), '1.0-2') + ' ' + token?.symbol, extraValue: `(${this.data.percentageMarketCap(100, token)})` },
          { title: $localize`Initial price per token`, value: (token?.pricePerToken || 0) + ' Mi'},
          ...(token?.allocations || []).map(a => ({ title: a.title + ' (Initial Cap)', value: a.percentage + '%', extraValue: `(${this.data.percentageMarketCap(a.percentage, token)})` }))
        ];
        this.setLineChartData(token);
        this.cd.markForCheck();
      });
  }

  public setLineChartData(token?: Token): void {
    if (!token) return;
    this.colors = [
      ...INITIAL_COLORS.slice(0, token.allocations.length),
      ...(new Array(Math.max(token.allocations.length - INITIAL_COLORS.length, 0)).fill(null).map(() => getRandomColor()))
    ];
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
    return this.decimalPipe.transform((token.totalSupply / 1000 / 1000 * Number(a.percentage) / 100).toFixed(2), '1.0-2') + ' ' + token.symbol;
  }
}
