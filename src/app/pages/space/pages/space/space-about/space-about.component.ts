import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { DataService } from '@pages/space/services/data.service';
import { Subscription } from "rxjs";
import { FILE_SIZES } from '../../../../../../../functions/interfaces/models/base';
import { SpaceApi } from '../../../../../@api/space.api';
import { NotificationService } from '../../../../../@core/services/notification/notification.service';
import { AuthService } from '../../../../../components/auth/services/auth.service';
import { AllianceExtended, SpaceWithAlliances } from './../../../../../@api/space.api';
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
  @Output() onLeave = new EventEmitter<void>();

  public isAlliancesListOpen = false;
  public isNewAllianceOpen = false;
  public isNewAlliance = false;
  public spaceAllianceControl: FormControl = new FormControl('', Validators.required);
  public reputationWeightControl: FormControl = new FormControl(1, Validators.required);
  private spacesSubscription?: Subscription;
  constructor(
    public deviceService: DeviceService,
    public data: DataService,
    public previewImageService: PreviewImageService,
    public cache: CacheService,
    private notification: NotificationService,
    private auth: AuthService,
    private spaceApi: SpaceApi
  ) { }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public get walletAddressEntities(): typeof EntityType {
    return EntityType;
  }


  public trackByUid(index: number, item: any): number {
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

  public getSortedAlliances(space?: SpaceWithAlliances|null): AllianceExtended[] {
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
      ).subscribe((val: any) => {
        this.closeNewAlliance();
      });
    });
  }

  public onAllianceEdit(ally: AllianceExtended): void {
    this.spaceAllianceControl.setValue(ally.uid);
    this.reputationWeightControl.setValue(ally.weight);
    this.openAlliance(false);
  }

  public ngOnDestroy(): void {
    this.spacesSubscription?.unsubscribe();
  }
}
