import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import * as dayjs from 'dayjs';
import { Transaction } from "functions/interfaces/models";
import {
  ApexAxisChartSeries,
  ApexChart, ApexDataLabels, ApexFill, ApexMarkers, ApexStroke, ApexTitleSubtitle, ApexTooltip, ApexXAxis, ApexYAxis, ChartComponent
} from "ng-apexcharts";
import { map } from "rxjs";
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
  constructor(
    private cd: ChangeDetectorRef,
    public data: DataService
  ) {
    // Init empty.
    this.initChart([]);
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

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
