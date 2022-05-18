import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { download } from '@core/utils/tools.utils';
import { UnitsHelper } from '@core/utils/units-helper';
import { Member, Space } from '@functions/interfaces/models';
import { DataService } from '@pages/space/services/data.service';
import Papa from 'papaparse';
import { first, skip, Subscription } from "rxjs";
import { FILE_SIZES } from '../../../../../../../functions/interfaces/models/base';
import { NotificationService } from '../../../../../@core/services/notification/notification.service';
import { AuthService } from '../../../../../components/auth/services/auth.service';
import { AllianceExtended, SpaceApi, SpaceWithAlliances } from './../../../../../@api/space.api';
import { CacheService } from './../../../../../@core/services/cache/cache.service';
import { EntityType } from './../../../../../components/wallet-address/wallet-address.component';


@Component({
  selector: 'wen-space-about',
  templateUrl: './space-about.component.html',
  styleUrls: ['./space-about.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpaceAboutComponent implements OnDestroy {
  @Input() avatarUrl?: string;
  @Output() wenOnLeave = new EventEmitter<void>();

  public isAlliancesListOpen = false;
  public isNewAllianceOpen = false;
  public isNewAlliance = false;
  public exportingMembers = false;
  public spaceAllianceControl: FormControl = new FormControl('', Validators.required);
  public reputationWeightControl: FormControl = new FormControl(1, Validators.required);
  public tokenInfoLabels: string[] = [
    $localize`Icon`,
    $localize`Name`,
    $localize`Symbol`,
    $localize`Price`,
    $localize`Network`,
    $localize`Total supply`,
    $localize`Type`
  ];
  private spacesSubscription?: Subscription;
  constructor(
    public deviceService: DeviceService,
    public data: DataService,
    public previewImageService: PreviewImageService,
    public cache: CacheService,
    private notification: NotificationService,
    private auth: AuthService,
    private spaceApi: SpaceApi,
    private cd: ChangeDetectorRef
  ) { }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public get walletAddressEntities(): typeof EntityType {
    return EntityType;
  }


  public trackByUid(index: number, item: Member) {
    return item.uid;
  }

  public openAlliance(newAlliance = true): void {
    this.isAlliancesListOpen = false;
    this.isNewAllianceOpen = true;
    this.isNewAlliance = newAlliance;
  }

  public closeNewAlliance(): void {
    this.spaceAllianceControl.setValue('');
    this.spaceAllianceControl.reset();
    this.spaceAllianceControl.markAsPristine();
    this.reputationWeightControl.setValue(1);
    this.reputationWeightControl.reset();
    this.reputationWeightControl.markAsPristine();
    this.isNewAllianceOpen = false;
  }

  public getSortedAlliances(space?: SpaceWithAlliances | null): AllianceExtended[] {
    if (!space) {
      return [];
    }

    return Object.values(space.alliances || {});
  }

  // If the other space does not establish an alliance, your relationship will be in a state “Recognised”.
  public async onAllianceSave(enabled = true): Promise<void> {
    if (!this.spaceAllianceControl.value || !this.data.space$.value) {
      return;
    }

    await this.auth.sign({
      uid: this.data.space$.value.uid,
      targetSpaceId: this.spaceAllianceControl.value,
      enabled: enabled,
      weight: !enabled ? 0 : parseFloat(this.reputationWeightControl.value) || 0
    }, (sc, finish) => {
      this.notification.processRequest(
        this.spaceApi.setAlliance(sc),
        this.isNewAlliance ? 'Connection established' : 'Connection updated.',
        finish
      ).subscribe(() => {
        this.closeNewAlliance();
      });
    });
  }

  public onAllianceEdit(ally: AllianceExtended): void {
    this.spaceAllianceControl.setValue(ally.uid);
    this.reputationWeightControl.setValue(ally.weight);
    this.openAlliance(false);
  }

  public getShareUrl(space?: Space | null): string {
    return space?.wenUrlShort || space?.wenUrl || window.location.href;
  }

  public exportMembers(): void {
    if (this.exportingMembers) return;
    this.exportingMembers = true;

    const space = this.data.space$.value;
    if (!space?.uid) return;

    this.spaceApi.listenMembersWithoutData(space?.uid, undefined, undefined, this.data.space$.value?.totalMembers)
      .pipe(
        skip(1),
        first()
      )
      .subscribe((members) => {
        this.exportingMembers = false;
        const fields =
          ['', 'EthAddress'];
        const csv = Papa.unparse({
          fields,
          data: members.map(m => [m.uid])
        });

        const filteredSpaceName =
          space?.name?.toLowerCase().replace(/[^a-zA-Z0-9-_]/g, '');
        download(`data:text/csv;charset=utf-8${csv}`, `soonaverse_${filteredSpaceName}_members.csv`);
        this.cd.markForCheck();
      });
  }

  public formatBest(amount: number | undefined | null): string {
    if (!amount) {
      return '0 i';
    }

    return UnitsHelper.formatBest(Number(amount), 2);
  }

  public ngOnDestroy(): void {
    this.spacesSubscription?.unsubscribe();
  }
}
