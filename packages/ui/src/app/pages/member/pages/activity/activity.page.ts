import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { TokenApi } from '@api/token.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DEFAULT_SPACE } from '@components/space/components/select-space/select-space.component';
import { TimelineItem, TimelineItemType } from '@components/timeline/timeline.component';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { StorageService } from '@core/services/storage';
import { UnitsService } from '@core/services/units';
import { getItem, StorageItem } from '@core/utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { environment } from '@env/environment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { HelperService } from '@pages/member/services/helper.service';
import {
  Member,
  Network,
  SOON_SPACE,
  SOON_SPACE_TEST,
  SOON_TOKEN,
  SOON_TOKEN_TEST,
  Space,
  StakeType,
  Token,
  Transaction,
} from '@soonaverse/interfaces';
import { ChartConfiguration, ChartType } from 'chart.js';
import dayjs from 'dayjs';
import { BehaviorSubject, map, Observable, of, switchMap } from 'rxjs';
import { CacheService } from './../../../../@core/services/cache/cache.service';
import { DataService, MemberAction } from './../../services/data.service';

@UntilDestroy()
@Component({
  selector: 'wen-activity',
  templateUrl: './activity.page.html',
  styleUrls: ['./activity.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityPage implements OnInit {
  public spaceForm: FormGroup;
  public spaceControl: FormControl;
  public defaultSpace = DEFAULT_SPACE;
  public lineChartType: ChartType = 'line';
  public lineChartData?: ChartConfiguration['data'];
  public lineChartOptions?: ChartConfiguration['options'] = {};
  public selectedSpace?: Space;
  public soonTokenId = SOON_TOKEN;
  public openTokenStake = false;
  public tokenFavourites: string[] = getItem(StorageItem.FavouriteTokens) as string[];
  public token$: BehaviorSubject<Token | undefined> = new BehaviorSubject<Token | undefined>(
    undefined,
  );
  constructor(
    private storageService: StorageService,
    private tokenApi: TokenApi,
    public auth: AuthService,
    public data: DataService,
    public unitsService: UnitsService,
    public helper: HelperService,
    public cache: CacheService,
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
  ) {
    // Init empty.
    this.spaceControl = new FormControl(
      storageService.selectedSpace.getValue() || DEFAULT_SPACE.value,
    );
    this.spaceForm = new FormGroup({
      space: this.spaceControl,
    });
  }

  public ngOnInit(): void {
    this.tokenApi
      .listen(environment.production ? SOON_TOKEN : SOON_TOKEN_TEST)
      .pipe(untilDestroyed(this))
      .subscribe(this.token$);
    this.spaceControl.valueChanges
      .pipe(
        switchMap((spaceId) => this.cache.getSpace(spaceId)),
        untilDestroyed(this),
      )
      .subscribe((space) => {
        this.selectedSpace = space;
      });

    this.spaceForm.valueChanges.pipe(untilDestroyed(this)).subscribe((o) => {
      this.storageService.selectedSpace.next(o.space);
      this.data.refreshBadges(this.selectedSpace);
    });

    let prev: string | undefined;
    this.data.member$?.pipe(untilDestroyed(this)).subscribe((obj) => {
      if (prev !== obj?.uid) {
        this.data.refreshBadges(this.selectedSpace);
        prev = obj?.uid;
      }
    });
  }

  public getSoonSpaceId(): string {
    return environment.production ? SOON_SPACE : SOON_SPACE_TEST;
  }

  public getTotalStaked(): Observable<number> {
    return this.auth.memberSoonDistribution$.pipe(
      map((v) => {
        return v?.stakes?.[StakeType.DYNAMIC].amount || 0;
      }),
    );
  }

  public getTotalStakedValue(): Observable<number> {
    return this.auth.memberSoonDistribution$.pipe(
      map((v) => {
        return v?.stakes?.[StakeType.DYNAMIC].value || 0;
      }),
    );
  }

  public editProfile(): void {
    this.data.triggerAction$.next(MemberAction.EDIT);
  }

  public manageAddresses(): void {
    this.data.triggerAction$.next(MemberAction.MANAGE_ADDRESSES);
  }

  public getLevelExpiry(): Observable<dayjs.Dayjs | undefined> {
    return this.auth.memberSoonDistribution$.pipe(
      map((v) => {
        const vals = v?.stakeExpiry?.[StakeType.DYNAMIC];
        if (!vals) {
          return undefined;
        }

        const maxKey = <number[]>Object.keys(vals)
          .map((v) => {
            return parseInt(v);
          })
          .sort((a, b) => {
            return b - a;
          });

        return dayjs(maxKey[0]);
      }),
    );
  }

  public getTotalRewarded(): Observable<number> {
    return this.auth.memberSoonDistribution$.pipe(
      map((v) => {
        return v?.stakeRewards || 0;
      }),
    );
  }

  public getTotalUnclaimed(): Observable<number> {
    return this.auth.memberSoonDistribution$.pipe(
      map((d) => {
        if (!d) {
          return 0;
        }

        return d.tokenDrops?.length ? d.tokenDrops.reduce((pv, cv) => pv + cv.count, 0) : 0;
      }),
    );
  }

  public userHasStake$(): Observable<boolean> {
    return this.auth.memberSoonDistribution$.pipe(
      map((v) => {
        return !!(v?.stakes?.[StakeType.DYNAMIC]?.value || 0);
      }),
    );
  }

  public get networkTypes(): typeof Network {
    return Network;
  }

  public get loggedInMember$(): BehaviorSubject<Member | undefined> {
    return this.auth.member$;
  }

  public getTotal(
    member: Member | null | undefined,
    space: Space | null | undefined,
    what: 'awardsCompleted' | 'totalReputation',
  ): Observable<number> {
    // awardsCompleted
    if (!space) {
      return of(0);
    }

    if (this.spaceForm.value.space === this.defaultSpace.value) {
      return of(Math.trunc(member?.[what] || 0));
    }

    return of(Math.trunc(member?.spaces?.[this.spaceForm.value.space]?.[what] || 0));
  }

  public getBadgeRoute(): string[] {
    return ['../', ROUTER_UTILS.config.member.badges];
  }

  public getSpaceRoute(spaceId: string): string[] {
    return ['/', ROUTER_UTILS.config.space.root, spaceId];
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public getTimelineItems(badges?: Transaction[] | null): TimelineItem[] {
    return (
      badges?.map((b) => ({
        type: TimelineItemType.BADGE,
        payload: {
          image: b.payload.image,
          date: b.createdOn?.toDate(),
          name: b.payload.name,
          network: b.network,
        },
      })) || []
    );
  }
}
