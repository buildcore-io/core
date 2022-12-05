import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { UnitsService } from '@core/services/units';
import { download } from '@core/utils/tools.utils';
import { environment } from '@env/environment';
import { HelperService } from '@pages/collection/services/helper.service';
import { DataService } from '@pages/space/services/data.service';
import {
  FILE_SIZES,
  Member,
  SOON_SPACE,
  SOON_SPACE_TEST,
  Space,
  StakeType,
} from '@soonaverse/interfaces';
import Papa from 'papaparse';
import { combineLatest, first, map, Observable, skip, Subscription } from 'rxjs';
import { SpaceApi } from './../../../../../@api/space.api';
import { EntityType } from './../../../../../components/wallet-address/wallet-address.component';

@Component({
  selector: 'wen-space-about',
  templateUrl: './space-about.component.html',
  styleUrls: ['./space-about.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceAboutComponent implements OnDestroy {
  @Input() avatarUrl?: string;
  @Output() wenOnLeave = new EventEmitter<void>();
  public isManageAddressesOpen = false;
  public exportingMembers = false;
  public openTokenStake = false;
  public amount?: number = undefined;
  private spacesSubscription?: Subscription;

  constructor(
    public deviceService: DeviceService,
    public unitsService: UnitsService,
    public data: DataService,
    public previewImageService: PreviewImageService,
    public auth: AuthService,
    public helper: HelperService,
    private spaceApi: SpaceApi,
    private cd: ChangeDetectorRef,
  ) {}

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }
  public openStakeModal(amount?: number): void {
    this.amount = amount ? amount / 1000 / 1000 : undefined;
    this.openTokenStake = true;
    this.cd.markForCheck();
  }

  public get walletAddressEntities(): typeof EntityType {
    return EntityType;
  }

  public trackByUid(index: number, item: Member) {
    return item.uid;
  }

  public getShareUrl(space?: Space | null): string {
    return space?.wenUrlShort || space?.wenUrl || window?.location.href;
  }

  public loggedInUserStake(): Observable<number> {
    return this.data.tokenDistribution$.pipe(
      map((v) => {
        return (
          (v?.stakes?.[StakeType.DYNAMIC]?.value || 0) + (v?.stakes?.[StakeType.STATIC]?.value || 0)
        );
      }),
    );
  }

  public stakePrc(): Observable<number> {
    return combineLatest([this.data.token$, this.data.tokenStats$]).pipe(
      map(([token, stats]) => {
        const totalStaked =
          (stats?.stakes?.[StakeType.DYNAMIC]?.amount || 0) +
          (stats?.stakes?.[StakeType.STATIC]?.amount || 0);
        return totalStaked / (token?.totalSupply || 0);
      }),
    );
  }

  public stakeTotal(): Observable<number> {
    return this.data.tokenStats$.pipe(
      map((stats) => {
        return (
          (stats?.stakes?.[StakeType.DYNAMIC]?.stakingMembersCount || 0) +
          (stats?.stakes?.[StakeType.STATIC]?.stakingMembersCount || 0)
        );
      }),
    );
  }

  public exportMembers(): void {
    if (this.exportingMembers) return;
    this.exportingMembers = true;

    const space = this.data.space$.value;
    if (!space?.uid) return;

    this.spaceApi
      .listenMembersWithoutData(
        space?.uid,
        undefined,
        undefined,
        this.data.space$.value?.totalMembers,
      )
      .pipe(skip(1), first())
      .subscribe((members) => {
        this.exportingMembers = false;
        const fields = ['', 'EthAddress'];
        const csv = Papa.unparse({
          fields,
          data: members.map((m) => [m.uid]),
        });

        const filteredSpaceName = space?.name?.toLowerCase().replace(/[^a-zA-Z0-9-_]/g, '');
        download(
          `data:text/csv;charset=utf-8${csv}`,
          `soonaverse_${filteredSpaceName}_members.csv`,
        );
        this.cd.markForCheck();
      });
  }

  public isSoonSpace(): Observable<boolean> {
    return this.data.space$.pipe(
      map((s) => {
        return s?.uid === (environment.production ? SOON_SPACE : SOON_SPACE_TEST);
      }),
    );
  }

  public ngOnDestroy(): void {
    this.spacesSubscription?.unsubscribe();
  }
}
