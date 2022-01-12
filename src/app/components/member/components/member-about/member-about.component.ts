import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FileApi } from '@api/file.api';
import { DeviceService } from '@core/services/device';
import { DataService } from '@pages/member/services/data.service';
import { BehaviorSubject } from 'rxjs';
import { FILE_SIZES } from './../../../../../../functions/interfaces/models/base';
import { Member } from './../../../../../../functions/interfaces/models/member';

@Component({
  selector: 'wen-member-about',
  templateUrl: './member-about.component.html',
  styleUrls: ['./member-about.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberAboutComponent {
  @Input() data?: DataService;
  @Input() avatarSrc?: string;
  @Input() loggedInMember?: BehaviorSubject<Member|undefined>;
  @Input() trackByUid: (index: number, item: any) => number = (index: number) => index;

  public drawerVisible$ = new BehaviorSubject<boolean>(false);

  constructor(
    public deviceService: DeviceService
  ) { }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public getAvatarSize(url?: string|null): string|undefined {
    if (!url) {
      return undefined;
    }

    return FileApi.getUrl(url, 'space_avatar', FILE_SIZES.small);
  }

  public openDrawer(): void {
    this.drawerVisible$.next(true);
  }

  public closeDrawer(): void {
    this.drawerVisible$.next(false);
  }
}
