import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { Space } from '@functions/interfaces/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
  ApexChart, ApexDataLabels, ApexFill, ApexLegend, ApexNonAxisChartSeries,
  ApexResponsive
} from "ng-apexcharts";
import { BehaviorSubject, Subscription } from 'rxjs';
import { Proposal, ProposalAnswer, ProposalType } from '../../../../../../functions/interfaces/models/proposal';
import { SpaceApi } from './../../../../@api/space.api';
import { ROUTER_UTILS } from './../../../../@core/utils/router.utils';

export type ChartOptions = {
  chart: ApexChart;
  responsive: ApexResponsive[];
  labels: any;
  fill: ApexFill;
  legend: ApexLegend;
  dataLabels: ApexDataLabels;
};

@UntilDestroy()
@Component({
  selector: 'wen-proposal-card',
  templateUrl: './proposal-card.component.html',
  styleUrls: ['./proposal-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProposalCardComponent implements OnChanges, OnDestroy {
  @Input() proposal?: Proposal;
  @Input() fullWidth?: boolean;
  public space$: BehaviorSubject<Space|undefined> = new BehaviorSubject<Space|undefined>(undefined);
  public chartOptions: Partial<ChartOptions>;
  public path = ROUTER_UTILS.config.proposal.root;
  private subscriptions$: Subscription[] = [];

  constructor(
    private spaceApi: SpaceApi,
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService
  ) {
    this.chartOptions = {
      // series: [44, 55, 41, 17, 15],
      chart: {
        width: 180,
        type: "donut"
      },
      dataLabels: {
        enabled: true,
        formatter: function (val) {
          return val + "%"
        },
      },
      labels: [],
      fill: {
        type: "gradient"
      },
      legend: {
        show: false
        // formatter: function(val: any, opts: any) {
        //   return val + " - " + opts.w.globals.series[opts.seriesIndex];
        // }
      },
      responsive: [
        {
          breakpoint: 480,
          options: {
            chart: {
              width: 200
            },
            legend: {
              position: "bottom"
            }
          }
        }
      ]
    };
  }

  public getChartSeries(a: ProposalAnswer[]): ApexNonAxisChartSeries {
    return a.map((o) => {
      return this.proposal?.results?.answers?.[o.value] || 0;
    }).filter((value) => {
      return value !== 0;
    });
  }

  public getChartSeriesLabels(a: ProposalAnswer[]): string[] {
    return a.map((o) => {
      return o.text;
    });
  }

  public getProgress(proposal: Proposal|null|undefined, a: ProposalAnswer): number {
    if (proposal?.type === ProposalType.MEMBERS) {
      let total = 0;
      if (proposal?.results?.answers) {
        Object.keys(proposal?.results?.answers).forEach((b: any) => {
          total += proposal?.results?.answers[b] || 0;
        });
      }

      return  (proposal?.results?.answers?.[a.value] || 0) / (total) * 100;
    } else {
      let total = 0;
      if ((<any>proposal?.results)?.questions?.[0].answers) {
        (<any>proposal?.results)?.questions?.[0].answers.forEach((b: any) => {
          if (b.value === 0 || b.value === 255) {
            return;
          }

          total += b.accumulated || 0;
        });
      }

      const ans: any = (<any>proposal?.results)?.questions?.[0].answers.find((suba: any) => {
        return suba.value === a.value;
      });

      return  (ans?.accumulated || 0) / (total) * 100;
    }
  }

  public ngOnChanges(): void {
    if (this.proposal?.space) {
      this.subscriptions$.push(this.spaceApi.listen(this.proposal.space).pipe(untilDestroyed(this)).subscribe(this.space$));
    }
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
