import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { DataService, MemberAction } from '@pages/member/services/data.service';
import { FILE_SIZES, Member } from '@soonaverse/interfaces';
import { BehaviorSubject } from 'rxjs';
import { EntityType } from './../../../wallet-address/wallet-address.component';

@Component({
  selector: 'wen-member-about',
  templateUrl: './member-about.component.html',
  styleUrls: ['./member-about.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberAboutComponent {
  @Input() avatarSrc?: string;
  @Input() loggedInMember?: BehaviorSubject<Member | undefined>;

  public drawerVisible$ = new BehaviorSubject<boolean>(false);
  public isManageAddressesOpen = false;

  constructor(
    public deviceService: DeviceService,
    public data: DataService,
    public previewImageService: PreviewImageService,
    public auth: AuthService,
    public cd: ChangeDetectorRef,
  ) {}

  public ngOnInit(): void {
    this.data.triggerAction$.subscribe((s) => {
      if (s === MemberAction.EDIT) {
        this.openDrawer();
      } else if (s === MemberAction.MANAGE_ADDRESSES) {
        this.isManageAddressesOpen = true;
        this.cd.markForCheck();
      }
    });
  }

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
