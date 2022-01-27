import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { SelectBoxOption, SelectBoxSizes } from '@components/select-box/select-box.component';
import { DeviceService } from '@core/services/device';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import * as dayjs from 'dayjs';
import { Member, Space, Transaction } from "functions/interfaces/models";
import {
  ApexAxisChartSeries,
  ApexChart, ApexDataLabels, ApexFill, ApexMarkers, ApexStroke, ApexTitleSubtitle, ApexTooltip, ApexXAxis, ApexYAxis, ChartComponent
} from "ng-apexcharts";
import { map } from "rxjs";
import { DEFAULT_SPACE } from './../../../discover/pages/members/members.page';
import { DataService } from "./../../services/data.service";

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  dataLabels: ApexDataLabels;
  markers: ApexMarkers;
  title: ApexTitleSubtitle;
  fill: ApexFill;
  yaxis: ApexYAxis;
  xaxis: ApexXAxis;
  tooltip: ApexTooltip;
  stroke: ApexStroke;
  colors: any;
  toolbar: any;
};

@Component({
  selector: 'wen-activity',
  templateUrl: './activity.page.html',
  styleUrls: ['./activity.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityPage implements OnInit {
  @ViewChild("chart", { static: false }) public chart?: ChartComponent;

  public chartOptions: Partial<ChartOptions> = {};
  public activeOptionButton = "all";
  public spaceForm: FormGroup;
  public defaultSpace = DEFAULT_SPACE;
  public selectBoxSizes = SelectBoxSizes;

  constructor(
    private cd: ChangeDetectorRef,
    public data: DataService,
    public deviceService: DeviceService
  ) {
    // Init empty.
    this.initChart([]);
    this.spaceForm = new FormGroup({
      space: new FormControl(DEFAULT_SPACE.value),
      includeAlliances: new FormControl(false)
    });
  }

  public ngOnInit(): void {
    this.data.badges$.pipe(
      map((o) => {
        return o?.map((t: Transaction) => {
          return [t.createdOn?.toDate(), t.payload.xp];
        });
      })
    ).subscribe((data) => {
      // Sort by day.
      data = data?.sort((a, b) => {
        return a[0] - b[0];
      });

      if (data && data.length > 0) {
        let prevDate = data[0][0];
        let prevAmount = data[0][1];
        data.forEach((d) => {
          if (prevDate !== d[0]) {
            d[1] = d[1] + prevAmount;
            prevDate = d[0];
            prevAmount = d[1];
          }
        });
      }

      this.initChart(data || []);
    });
  }

  public getAwardsCompleted(member: Member | null | undefined): number {
    if (this.spaceForm.value.space !== this.defaultSpace.value) {
      if (this.spaceForm.value.includeAlliances) {
        return this.data.getAlliances(this.spaceForm.value.space, true).reduce((acc, alliance) => acc + alliance.totalAwards, 0);
      } else {
        return member?.statsPerSpace?.[this.spaceForm.value.space]?.awardsCompleted || 0;
      }
    } else {
      return member?.awardsCompleted || 0;
    }
  }

  public getReputation(member: Member | null | undefined): number {
    if (this.spaceForm.value.space !== this.defaultSpace.value) {
      if (this.spaceForm.value.includeAlliances) {
        return this.data.getAlliances(this.spaceForm.value.space, true).reduce((acc, alliance) => acc + alliance.totalXp, 0);
      } else {
        return member?.statsPerSpace?.[this.spaceForm.value.space]?.totalReputation || 0;
      }
    } else {
      return member?.totalReputation || 0;
    }
  }

  public getBadgeRoute(): string[] {
    return ['../', ROUTER_UTILS.config.member.badges];
  }

  public getSpaceRoute(spaceId: string): string[] {
    return ['/', ROUTER_UTILS.config.space.root, spaceId]
  }

  public initChart(data: any): void {
    this.chartOptions = {
      series: [
        {
          data: data
        }
      ],
      chart: {
        type: "area",
        height: 350
      },
      dataLabels: {
        enabled: false
      },
      markers: {
        size: 0
      },
      xaxis: {
        type: "datetime",
        min: (data?.[0]?.[0] || dayjs().subtract(1, 'month').toDate()).getTime(),
        tickAmount: 6
      },
      tooltip: {
        x: {
          format: "dd MMM yyyy"
        }
      },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.9,
          stops: [0, 100]
        }
      }
    };
    this.cd.markForCheck();
  }

  public getSpaceListOptions(list?: Space[] | null): SelectBoxOption[] {
    return [DEFAULT_SPACE].concat((list || []).map((o) => {
      return {
        label: o.name || o.uid,
        value: o.uid
      };
    }));
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
