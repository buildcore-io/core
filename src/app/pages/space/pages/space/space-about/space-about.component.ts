import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { DeviceService } from '@core/services/device';
import { DataService } from '@pages/space/services/data.service';
import { BehaviorSubject, Subscription } from "rxjs";
import { FILE_SIZES } from '../../../../../../../functions/interfaces/models/base';
import { Space } from '../../../../../../../functions/interfaces/models/space';
import { FileApi } from '../../../../../@api/file.api';
import { SpaceApi } from '../../../../../@api/space.api';
import { NotificationService } from '../../../../../@core/services/notification/notification.service';
import { AuthService } from '../../../../../components/auth/services/auth.service';
import { FULL_LIST } from './../../../../../@api/base.api';
import { AllianceExtended, SpaceWithAlliances } from './../../../../../@api/space.api';

@Component({
  selector: 'wen-space-about',
  templateUrl: './space-about.component.html',
  styleUrls: ['./space-about.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpaceAboutComponent implements OnDestroy {
  @Input() avatarUrl?: string;
  @Output() onLeave = new EventEmitter<void>();

  public isAlliancesListModal = false;
  public isNewAllianceModalOpen = false;
  public isNewAlliance = false;
  public spaceAllianceControl: FormControl = new FormControl('', Validators.required);
  public reputationWeightControl: FormControl = new FormControl(null, Validators.required);
  public allSpaces$: BehaviorSubject<Space[]|[]> = new BehaviorSubject<Space[]|[]>([]);
  private spacesSubscription?: Subscription;
  constructor(
    public deviceService: DeviceService,
    public data: DataService,
    private notification: NotificationService,
    private auth: AuthService,
    private spaceApi: SpaceApi
  ) { }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public trackByGuardianUid(index: number, item: any): number {
    return item.uid;
  }

  public trackByAlliedSpaceUid(index: number, item: any): string {
    return item.uid;
  }

  public openAlliance(newAlliance = true): void {
    this.isAlliancesListModal = false;
    this.isNewAllianceModalOpen = true;
    this.isNewAlliance = newAlliance;

    // Load spaces if not loaded yet.
    if (!this.spacesSubscription) {
      // TODO Add searching / pagging.
      this.spacesSubscription = this.spaceApi.alphabetical(undefined, undefined, FULL_LIST).subscribe(this.allSpaces$);
    }
  }

  public getAvatarSize(url?: string|null): string|undefined {
    if (!url) {
      return undefined;
    }

    return FileApi.getUrl(url, 'space_avatar', FILE_SIZES.small);
  }

  public closeNewAlliance(): void {
    this.spaceAllianceControl.setValue('');
    this.spaceAllianceControl.reset();
    this.spaceAllianceControl.markAsPristine();
    this.reputationWeightControl.setValue('');
    this.reputationWeightControl.reset();
    this.reputationWeightControl.markAsPristine();
    this.isNewAllianceModalOpen = false;
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
      weight: !enabled ? 0 : parseInt(this.reputationWeightControl.value) || 0
    }, (sc, finish) => {
      this.notification.processRequest(
        this.spaceApi.setAlliance(sc),
        this.isNewAlliance ? 'Alliance established' : 'Alliance updated.',
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
