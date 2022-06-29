import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { DEFAULT_SPACE } from '@components/space/components/select-space/select-space.component';
import { TimelineItem, TimelineItemType } from '@components/timeline/timeline.component';
import { DeviceService } from '@core/services/device';
import { StorageService } from '@core/services/storage';
import { ThemeList, ThemeService } from '@core/services/theme';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { HelperService } from '@pages/member/services/helper.service';
import { ChartConfiguration, ChartType } from 'chart.js';
import dayjs from 'dayjs';
import { Member, Space, Transaction } from "functions/interfaces/models";
import { combineLatest, filter, map, Observable, of, switchMap } from "rxjs";
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
  public lineChartData?: ChartConfiguration['data'];
  public lineChartOptions?: ChartConfiguration['options'] = {};
  public selectedSpace?: Space;
  
  constructor(
    private cd: ChangeDetectorRef,
    private storageService: StorageService,
    private themeService: ThemeService,
    public data: DataService,
    public helper: HelperService,
    public cache: CacheService,
    public deviceService: DeviceService
  ) {
    // Init empty.
    this.spaceControl = new FormControl(storageService.selectedSpace.getValue() || DEFAULT_SPACE.value);
    this.spaceForm = new FormGroup({
      space: this.spaceControl,
      includeAlliances: new FormControl(storageService.isIncludeAlliancesChecked.getValue())
    });
  }

  public ngOnInit(): void {
    this.cache.fetchAllSpaces();
    combineLatest([this.data.badges$, this.themeService.theme$])
      .pipe(
        filter(([obj, theme]) => !!obj && !!theme),
        map(([obj, theme]) => [obj?.map((t: Transaction) => [t.createdOn?.toDate(), t.payload.xp]), theme]),
        untilDestroyed(this)
      )
      .subscribe(([data, theme]) => {
        data = (data || []) as any[][];
        switch (theme) {
        case ThemeList.Light:
          this.setLineChartOptions('#959388', '#fff', '#333');
          this.initChart(data, {
            backgroundColor: '#FCFBF9',
            borderColor: '#F39200',
            pointBackgroundColor: '#F39200',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#333',
            pointHoverBorderColor: '#fff'
          });
          break;
        case ThemeList.Dark:
          this.setLineChartOptions('#6A6962', '#333', '#fff');
          this.initChart(data || [], {
            backgroundColor: '#232323',
            borderColor: '#F39200',
            pointBackgroundColor: '#F39200',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#333',
            pointHoverBorderColor: '#fff'
          });
          break;
        }
      });

    this.spaceControl.valueChanges
      .pipe(
        switchMap(spaceId => this.cache.getSpace(spaceId)),
        untilDestroyed(this)
      )
      .subscribe(space => {
        this.selectedSpace = space;
      });

    this.spaceForm.valueChanges
      .pipe(
        untilDestroyed(this)
      )
      .subscribe((o) => {
        if (o.space === this.defaultSpace.value && o.includeAlliances) {
          this.spaceForm.controls.includeAlliances.setValue(false);
          return;
        }
        this.storageService.selectedSpace.next(o.space);
        this.storageService.isIncludeAlliancesChecked.next(o.includeAlliances);
        this.data.refreshBadges(this.selectedSpace, this.spaceForm.value.includeAlliances);
      });

    let prev: string | undefined;
    this.data.member$?.pipe(untilDestroyed(this)).subscribe((obj) => {
      if (prev !== obj?.uid) {
        this.data.refreshBadges(this.selectedSpace, this.spaceForm.value.includeAlliances);
        prev = obj?.uid;
      }
    });
  }

  public getTotal(member: Member | null | undefined, space: Space | null | undefined, what: 'awardsCompleted'|'totalReputation'): Observable<number> { // awardsCompleted
    if (!space) {
      return of(0);
    }

    if (this.spaceForm.value.space === this.defaultSpace.value) {
      return of(Math.trunc(member?.[what] || 0));
    }

    if (!this.spaceForm.value.includeAlliances || Object.keys(space?.alliances || {}).length === 0) {
      return of(Math.trunc(member?.spaces?.[this.spaceForm.value.space]?.[what] || 0));
    }

    const spaceObservables: Observable<Space | undefined>[] =
      Object.entries(space?.alliances || {}).map(([spaceId]) => this.cache.getSpace(spaceId));

    return combineLatest(spaceObservables)
      .pipe(
        map(allianceSpaces => {
          let total = member?.spaces?.[this.selectedSpace?.uid || 0]?.[what] || 0;
          for (const allianceSpace of allianceSpaces) {
            if (allianceSpace && this.selectedSpace?.alliances[allianceSpace.uid].enabled === true) {
              const value: number = member?.spaces?.[allianceSpace.uid]?.[what] || 0;
              total += Math.trunc((what === 'totalReputation') ?
                (value * this.selectedSpace?.alliances[allianceSpace.uid].weight) : value);
            }
          }
          return Math.trunc(total);
        })
      );
  }

  public getBadgeRoute(): string[] {
    return ['../', ROUTER_UTILS.config.member.badges];
  }

  public getSpaceRoute(spaceId: string): string[] {
    return ['/', ROUTER_UTILS.config.space.root, spaceId]
  }

  private setLineChartOptions(axisColor: string, tooltipColor: string, tooltipBackgroundColor: string): void {
    this.lineChartOptions = {
      elements: {
        line: {
          tension: 0
        }
      },
      scales: {
        xAxis: {
          ticks: {
            maxTicksLimit: 10,
            color: axisColor,
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
            color: axisColor,
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
          backgroundColor: tooltipBackgroundColor,
          titleColor: 'rgba(0,0,0,0)',
          titleSpacing: 0,
          titleMarginBottom: 0,
          titleFont: {
            lineHeight: 0
          },  
          bodyColor: tooltipColor,
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
  }

  private initChart(data: any[][], colorOptions: object): void {
    const dataToShow: { data: number[]; labels: string[]} = {
      data: [],
      labels: []
    };

    if (data?.length) {
      const sortedData = data.sort((a, b) => a[0] - b[0]);
      const dataMap = data.reduce((acc, cur) => {
        const key = dayjs(cur[0]).format('DD_MM_YYYY');
        return { ...acc, [key]: [...(acc[key] || []), cur] };
      }, {} as any)
      const dataSize = Math.floor(dayjs(sortedData[sortedData.length - 1][0]).diff(dayjs(sortedData[0][0]), 'day', true)) + 1;
      let sumValue = 0;
      for (let i=0; i<dataSize; i++) {
        const date = dayjs(sortedData[0][0]).add(i, 'day').toDate();
        const key = dayjs(date).format('DD_MM_YYYY');
        if (dataMap[key]) {
          sumValue += dataMap[key].reduce((acc: number, cur: any[]) => acc + (cur[1] as number), 0);
        }
        dataToShow.data.push(sumValue);
        dataToShow.labels.push(dayjs(date).format('MMM D'));
      }
    }

    this.lineChartData = {
      datasets: [
        {
          data: dataToShow.data,
          fill: 'origin',
          ...colorOptions
        }
      ],
      labels: dataToShow.labels
    };
    this.cd.markForCheck();
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public getTimelineItems(badges?: Transaction[] | null): TimelineItem[] {
    return badges?.map(b => ({
      type: TimelineItemType.BADGE,
      payload: {
        image: b.payload.image,
        date: b.createdOn?.toDate(),
        name: b.payload.name
      }
    })) || [];
  }
}
