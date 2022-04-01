import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { DataService } from '@pages/member/services/data.service';
import { BehaviorSubject } from 'rxjs';
import { FILE_SIZES } from './../../../../../../functions/interfaces/models/base';
import { Member } from './../../../../../../functions/interfaces/models/member';
import { EntityType } from './../../../wallet-address/wallet-address.component';

@Component({
  selector: 'wen-member-about',
  templateUrl: './member-about.component.html',
  styleUrls: ['./member-about.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberAboutComponent {
  @Input() avatarSrc?: string;
  @Input() loggedInMember?: BehaviorSubject<Member | undefined>;

  public drawerVisible$ = new BehaviorSubject<boolean>(false);

  constructor(
    public deviceService: DeviceService,
    public data: DataService,
    public previewImageService: PreviewImageService
  ) { }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public get walletAddressEntities(): typeof EntityType {
    return EntityType;
  }

  public openDrawer(): void {
    this.drawerVisible$.next(true);
  }

  public closeDrawer(): void {
    this.drawerVisible$.next(false);
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
