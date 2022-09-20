import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { DEFAULT_SPACE } from '@components/space/components/select-space/select-space.component';
import { TimelineItem, TimelineItemType } from '@components/timeline/timeline.component';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { StorageService } from '@core/services/storage';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { HelperService } from '@pages/member/services/helper.service';
import { ChartConfiguration, ChartType } from 'chart.js';
import { Member, Space, Transaction } from "functions/interfaces/models";
import { combineLatest, map, Observable, of, switchMap } from "rxjs";
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
    private storageService: StorageService,
    public data: DataService,
    public helper: HelperService,
    public cache: CacheService,
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService
  ) {
    // Init empty.
    this.spaceControl = new FormControl(storageService.selectedSpace.getValue() || DEFAULT_SPACE.value);
    this.spaceForm = new FormGroup({
      space: this.spaceControl,
      includeAlliances: new FormControl(storageService.isIncludeAlliancesChecked.getValue())
    });
  }

  public ngOnInit(): void {
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

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public getTimelineItems(badges?: Transaction[] | null): TimelineItem[] {
    return badges?.map(b => ({
      type: TimelineItemType.BADGE,
      payload: {
        image: b.payload.image,
        date: b.createdOn?.toDate(),
        name: b.payload.name,
        network: b.network
      }
    })) || [];
  }
}
