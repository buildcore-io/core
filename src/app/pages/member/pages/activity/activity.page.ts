import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { SelectBoxOption, SelectBoxSizes } from '@components/select-box/select-box.component';
import { DeviceService } from '@core/services/device';
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

export const DEFAULT_SPACE: SelectBoxOption = {
  label: 'All spaces',
  value: 'all'
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
  public spacesList: SelectBoxOption[] = [DEFAULT_SPACE, 
    { label: 'Space 1', value: 'space1', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 2', value: 'space2', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 3', value: 'space3', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 4', value: 'space4', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 5', value: 'space5', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 6', value: 'space6', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 7', value: 'space7', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 8', value: 'space8', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 9', value: 'space9', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 10', value: 'space10', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 11', value: 'space11', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 12', value: 'space12', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 13', value: 'space13', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 14', value: 'space14', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 15', value: 'space15', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 16', value: 'space16', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 17', value: 'space17', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 18', value: 'space18', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 19', value: 'space19', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 20', value: 'space20', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 21', value: 'space21', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 22', value: 'space22', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 23', value: 'space23', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 24', value: 'space24', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 25', value: 'space25', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 26', value: 'space26', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 27', value: 'space27', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 28', value: 'space28', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 29', value: 'space29', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 30', value: 'space30', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 31', value: 'space31', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 32', value: 'space32', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 33', value: 'space33', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 34', value: 'space34', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 35', value: 'space35', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }, 
    { label: 'Space 36', value: 'space36', img: 'https://icons.iconarchive.com/icons/martz90/circle/24/video-camera-icon.png' }
  ];
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
