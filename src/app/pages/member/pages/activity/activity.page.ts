import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { DEFAULT_SPACE, SelectSpaceOption } from '@components/space/components/select-space/select-space.component';
import { TimelineType } from '@components/timeline/timeline.component';
import { DeviceService } from '@core/services/device';
import { StorageService } from '@core/services/storage';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ChartConfiguration, ChartType } from 'chart.js';
import dayjs from 'dayjs';
import { Member, Space, Transaction } from "functions/interfaces/models";
import { map } from "rxjs";
import { CacheService } from './../../../../@core/services/cache/cache.service';
import { DataService } from "./../../services/data.service";
@UntilDestroy()
@Component({
  selector: 'wen-activity',
  templateUrl: './activity.page.html',
  styleUrls: ['./activity.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityPage implements OnInit {
  public activeOptionButton = "all";
  public spaceForm: FormGroup;
  public spaceControl: FormControl;
  public defaultSpace = DEFAULT_SPACE;
  public lineChartType: ChartType = 'line';
  public badges = TimelineType.BADGE;

  public lineChartData?: ChartConfiguration['data'];

  public lineChartOptions: ChartConfiguration['options'] = {
    elements: {
      line: {
        tension: 0
      }
    },
    scales: {
      xAxis: {
        ticks: {
          maxTicksLimit: 10,
          color: '#959388',
          font: {
            size: 14,
            weight: '600',
            family: 'Poppins',
            lineHeight: '14px'
          }
        }
      },
      yAxis: {
        ticks: {
          color: '#959388',
          font: {
            size: 14,
            weight: '600',
            family: 'Poppins',
            lineHeight: '14px'
          }
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        xAlign: 'center',
        yAlign: 'bottom',
        backgroundColor: '#fff',
        titleColor: 'rgba(0,0,0,0)',
        titleSpacing: 0,
        titleMarginBottom: 0,
        titleFont: {
          lineHeight: 0
        },
        bodyColor: '#333333',
        bodyFont: {
          weight: '500',
          family: 'Poppins',
          size: 16,
          lineHeight: '28px'
        },
        bodyAlign: 'center',
        bodySpacing: 0,
        borderColor: 'rgba(0, 0, 0, 0.2)',
        borderWidth: 1,
        footerMarginTop: 0,
        caretPadding: 16,
        caretSize: 2,
        displayColors: false
      }
    }
  };

  constructor(
    private cd: ChangeDetectorRef,
    private storageService: StorageService,
    public data: DataService,
    public cache: CacheService,
    public deviceService: DeviceService
  ) {
    // Init empty.
    this.initChart([]);
    this.spaceControl = new FormControl(storageService.selectedSpace.getValue() || DEFAULT_SPACE.value);
    this.spaceForm = new FormGroup({
      space: this.spaceControl,
      includeAlliances: new FormControl(storageService.isIncludeAlliancesChecked.getValue())
    });
  }

  public ngOnInit(): void {
    this.data.badges$.pipe(
      untilDestroyed(this),
      map((o) => {
        return o?.map((t: Transaction) => {
          return [t.createdOn?.toDate(), t.payload.xp];
        });
      })
    ).subscribe((data) => {
      this.initChart(data || []);
    });

    this.spaceForm.valueChanges
      .pipe(untilDestroyed(this))
      .subscribe((o) => {
        if (o.space === this.defaultSpace.value && o.includeAlliances) {
          this.spaceForm.controls.includeAlliances.setValue(false);
          return;
        }
        this.storageService.selectedSpace.next(o.space);
        this.storageService.isIncludeAlliancesChecked.next(o.includeAlliances);
        this.data.refreshBadges(this.getSelectedSpace(), this.spaceForm.value.includeAlliances);
      });

    let prev: string | undefined;
    this.data.member$?.pipe(untilDestroyed(this)).subscribe((obj) => {
      if (prev !== obj?.uid) {
        this.data.refreshBadges(this.getSelectedSpace(), this.spaceForm.value.includeAlliances);
        prev = obj?.uid;
      }
    });
  }

  public getSelectedSpace(): Space | undefined {
    return this.cache.allSpaces$.value.find((s) => {
      return s.uid === this.spaceForm.value.space;
    });
  }

  public getTotal(member: Member | null | undefined, what: 'awardsCompleted' | 'totalReputation'): number { // awardsCompleted
    let total = 0;
    const space: Space | undefined = this.cache.allSpaces$.value.find((s) => {
      return s.uid === this.spaceForm.value.space;
    });

    if (this.spaceForm.value.space === this.defaultSpace.value) {
      total = member?.[what] || 0;
    } else {
      total = member?.spaces?.[this.spaceForm.value.space]?.[what] || 0;
      if (this.spaceForm.value.includeAlliances) {
        for (const [spaceId, values] of Object.entries(space?.alliances || {})) {
          const allianceSpace: Space | undefined = this.cache.allSpaces$.value.find((s) => {
            return s.uid === spaceId;
          });
          if (allianceSpace && values.enabled === true) {
            const value: number = member?.spaces?.[allianceSpace.uid]?.[what] || 0;
            total += Math.trunc((what === 'totalReputation') ? (value * values.weight) : value);
          }
        }
      }
    }

    return Math.trunc(total);
  }

  public getBadgeRoute(): string[] {
    return ['../', ROUTER_UTILS.config.member.badges];
  }

  public getSpaceRoute(spaceId: string): string[] {
    return ['/', ROUTER_UTILS.config.space.root, spaceId]
  }

  public initChart(data: any[][]): void {
    const dataToShow: { data: number[], labels: string[] } = {
      data: [],
      labels: []
    };

    if (data?.length) {
      const sortedData = data.sort((a, b) => a[0] - b[0]);
      const dataMap = data.reduce((acc, cur) => {
        const key = dayjs(cur[0]).format('DD_MM_YYYY');
        return { ...acc, [key]: cur };
      }, {} as any)
      const dataSize = Math.ceil(dayjs(sortedData[sortedData.length - 1][0]).diff(dayjs(sortedData[0][0]), 'day', true));
      let sumValue = 0;
      for (let i = 0; i < dataSize; i++) {
        const date = dayjs(sortedData[0][0]).add(i, 'day').toDate();
        const key = dayjs(date).format('DD_MM_YYYY');
        if (dataMap[key]) {
          sumValue += dataMap[key][1];
        }
        dataToShow.data.push(sumValue);
        dataToShow.labels.push(dayjs(date).format('MMM D'));
      }
    }

    this.lineChartData = {
      datasets: [
        {
          data: dataToShow.data,
          backgroundColor: '#FCFBF9',
          borderColor: '#F39200',
          pointBackgroundColor: '#F39200',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#333333',
          pointHoverBorderColor: '#fff',
          fill: 'origin'
        }
      ],
      labels: dataToShow.labels
    };
    this.cd.markForCheck();
  }

  public getSpaceListOptions(list?: Space[] | null): SelectSpaceOption[] {
    return (list || []).map((o) => ({
      label: o.name || o.uid,
      value: o.uid,
      img: o.avatarUrl
    }));
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
