import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { download } from '@core/utils/tools.utils';
import { Member, Space } from '@functions/interfaces/models';
import { DataService } from '@pages/space/services/data.service';
import Papa from 'papaparse';
import { first, skip, Subscription } from 'rxjs';
import { FILE_SIZES } from '../../../../../../../functions/interfaces/models/base';
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
  private spacesSubscription?: Subscription;

  constructor(
    public deviceService: DeviceService,
    public data: DataService,
    public previewImageService: PreviewImageService,
    private spaceApi: SpaceApi,
    private cd: ChangeDetectorRef,
  ) {
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
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

  public exportMembers(): void {
    if (this.exportingMembers) return;
    this.exportingMembers = true;

    const space = this.data.space$.value;
    if (!space?.uid) return;

    this.spaceApi.listenMembersWithoutData(space?.uid, undefined, undefined, this.data.space$.value?.totalMembers)
      .pipe(
        skip(1),
        first(),
      )
      .subscribe((members) => {
        this.exportingMembers = false;
        const fields =
          ['', 'EthAddress'];
        const csv = Papa.unparse({
          fields,
          data: members.map(m => [m.uid]),
        });

        const filteredSpaceName =
          space?.name?.toLowerCase().replace(/[^a-zA-Z0-9-_]/g, '');
        download(`data:text/csv;charset=utf-8${csv}`, `soonaverse_${filteredSpaceName}_members.csv`);
        this.cd.markForCheck();
      });
  }

  public ngOnDestroy(): void {
    this.spacesSubscription?.unsubscribe();
  }
}
