import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MemberApi } from '@api/member.api';
import { TransactionApi } from '@api/transaction.api';
import { SelectBoxOption, SelectBoxSizes } from '@components/select-box/select-box.component';
import { DeviceService } from '@core/services/device';
import { StorageService } from '@core/services/storage';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as dayjs from 'dayjs';
import { Member, Space, Transaction } from "functions/interfaces/models";
import { FILE_SIZES } from 'functions/interfaces/models/base';
import {
  ApexAxisChartSeries,
  ApexChart, ApexDataLabels, ApexFill, ApexMarkers, ApexStroke, ApexTitleSubtitle, ApexTooltip, ApexXAxis, ApexYAxis, ChartComponent
} from "ng-apexcharts";
import { firstValueFrom, map } from "rxjs";
import { FULL_LIST } from './../../../../@api/base.api';
import { CacheService } from './../../../../@core/services/cache/cache.service';
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

@UntilDestroy()
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
  public showAllBadges = false;
  private lastLoadedAllBadges: boolean = false;

  constructor(
    private cd: ChangeDetectorRef,
    private storageService: StorageService,
    private memberApi: MemberApi,
    private tranApi: TransactionApi,
    public data: DataService,
    public cache: CacheService,
    public deviceService: DeviceService
  ) {
    // Init empty.
    this.initChart([]);
    this.spaceForm = new FormGroup({
      space: new FormControl(storageService.selectedSpace.getValue()),
      includeAlliances: new FormControl(storageService.isIncludeAlliancesChecked.getValue())
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

    this.spaceForm.valueChanges
      .pipe(untilDestroyed(this))
      .subscribe((o) => {
        if (o.space === this.defaultSpace.value && o.includeAlliances) {
          this.spaceForm.controls.includeAlliances.setValue(false);
          return;
        }
        this.storageService.selectedSpace.next(o.space);
        this.storageService.isIncludeAlliancesChecked.next(o.includeAlliances);
        this.refreshBadges();
    });

    let prev: string | undefined;
    this.data.member$.subscribe((obj) => {
      if (prev !== obj?.uid) {
        this.refreshBadges();
        prev = obj?.uid;
      }
    });
  }

  public getSelectedSpace(): Space | undefined {
    return this.cache.allSpaces$.value.find((s) => {
      return s.uid === this.spaceForm.value.space;
    });
  }

  private async refreshBadges(): Promise<void> {
    if (this.data.member$.value?.uid) {
      if (!this.getSelectedSpace()) {
        // Already loaded. Do nothing. Reduce network requests.
        if (this.lastLoadedAllBadges) {
          return;
        }

        // TODO implement paging.
        this.lastLoadedAllBadges = true;
        this.memberApi.topBadges(this.data.member$.value.uid, 'createdOn', undefined, FULL_LIST).pipe(untilDestroyed(this)).subscribe(this.data.badges$);
      } else {
        this.lastLoadedAllBadges = false;
        this.data.badges$.next(undefined);
        const allBadges: string[] = [...(this.data.member$.value.spaces?.[this.getSelectedSpace()!.uid]?.badges || [])];
        if (this.spaceForm.value.includeAlliances) {
          for (const [spaceId] of Object.entries(this.getSelectedSpace()?.alliances || {})) {
            allBadges.push(...(this.data.member$.value.spaces?.[spaceId]?.badges || []));
          }
        }

        // Let's get first 6 badges.
        const finalBadgeTransactions: Transaction[] = [];
        for (const tran of allBadges) {
          const obj: Transaction | undefined = await firstValueFrom(this.tranApi.listen(tran));
          if (obj) {
            finalBadgeTransactions.push(obj);
          }
        }

        this.data.badges$.next(finalBadgeTransactions);
      }
    }
  }

  public getTotal(member: Member | null | undefined, what: 'awardsCompleted'|'totalReputation'): number { // awardsCompleted
    let total = 0;
    const space: Space|undefined = this.cache.allSpaces$.value.find((s) => {
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
          if (allianceSpace && values.enabled === true ) {
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
        value: o.uid,
        img: o.avatarUrl
      };
    }));
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }
}
