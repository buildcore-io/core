import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  DescriptionItem,
  DescriptionItemType,
} from '@components/description/description.component';
import { UnitsService } from '@core/services/units';
import { getRandomColor, TOKEN_METRICS_INITIAL_COLORS } from '@core/utils/colors.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from '@pages/token/services/data.service';
import { HelperService } from '@pages/token/services/helper.service';
import { Token, TokenAllocation } from '@soonaverse/interfaces';
import { ChartConfiguration, ChartType } from 'chart.js';

@UntilDestroy()
@Component({
  selector: 'wen-metrics',
  templateUrl: './metrics.page.html',
  styleUrls: ['./metrics.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricsPage implements OnInit {
  public colors: string[] = [];
  public doughnutChartType: ChartType = 'doughnut';
  public doughnutChartData?: ChartConfiguration['data'] = {
    datasets: [],
  };
  public doughnutChartOptions?: any = {
    events: [],
    plugins: {
      legend: {
        display: false,
      },
    },
    elements: {
      arc: {
        borderWidth: 0,
      },
    },
    cutout: '75%',
  };
  public breakdownData: DescriptionItem[] = [];

  constructor(
    public data: DataService,
    public helper: HelperService,
    public unitsService: UnitsService,
    private decimalPipe: DecimalPipe,
    private cd: ChangeDetectorRef,
  ) {}

  public ngOnInit(): void {
    this.data.token$.pipe(untilDestroyed(this)).subscribe((token) => {
      this.breakdownData = [
        {
          title: $localize`Total token supply`,
          type: DescriptionItemType.DEFAULT_NO_TRUNCATE,
          value:
            this.decimalPipe.transform(this.helper.formatTokenBest(token?.totalSupply), '1.0-2') +
            ' ' +
            token?.symbol,
          extraValue: `(${this.helper.percentageMarketCap(100, token)})`,
        },
      ];
      if (!this.helper.isMinted(token)) {
        this.breakdownData.push({
          title: $localize`Launchpad price per token`,
          type: DescriptionItemType.DEFAULT_NO_TRUNCATE,
          value: (token?.pricePerToken || 0) + ' ' + this.unitsService.label(),
        });

        this.breakdownData.push(
          ...(token?.allocations || []).map((a) => ({
            title: a.title + ' (' + $localize`Initial Cap` + ')',
            type: DescriptionItemType.DEFAULT_NO_TRUNCATE,
            value: a.percentage + '%',
            extraValue: `(${this.helper.percentageMarketCap(a.percentage, token)})`,
          })),
        );
      } else {
        this.breakdownData.push({
          title: $localize`Total melted tokens`,
          type: DescriptionItemType.DEFAULT_NO_TRUNCATE,
          value:
            this.decimalPipe.transform(
              this.helper.formatTokenBest(token?.mintingData?.meltedTokens),
              '1.0-2',
            ) +
            ' ' +
            token?.symbol,
        });
      }

      this.setLineChartData(token);
      this.cd.markForCheck();
    });
  }

  public setLineChartData(token?: Token): void {
    if (!token) return;
    this.colors = [
      ...TOKEN_METRICS_INITIAL_COLORS.slice(0, token.allocations.length),
      ...new Array(Math.max(token.allocations.length - TOKEN_METRICS_INITIAL_COLORS.length, 0))
        .fill(null)
        .map(() => getRandomColor()),
    ];
    this.doughnutChartData = {
      labels: token.allocations.map((a) => a.title),
      datasets: [
        {
          label: 'Dataset 1',
          data: token.allocations.map((a) => Number(a.percentage)),
          backgroundColor: this.colors,
        },
      ],
    };
    this.cd.markForCheck();
  }

  public percentageTokenAmount(a: TokenAllocation, token?: Token): string {
    if (!token) return '';
    return (
      this.decimalPipe.transform(
        (((token.totalSupply / 1000 / 1000) * Number(a.percentage)) / 100).toFixed(2),
        '1.0-2',
      ) +
      ' ' +
      token.symbol
    );
  }
}
