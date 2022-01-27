import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { DataService as MemberDataService } from '@pages/member/services/data.service';
import { DataService as SpaceDataService } from '@pages/space/services/data.service';
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
  @Input() avatarSrc?: string;
  @Input() loggedInMember?: BehaviorSubject<Member|undefined>;

  public drawerVisible$ = new BehaviorSubject<boolean>(false);

  constructor(
    public deviceService: DeviceService,
    public memberData: MemberDataService,
    public spaceData: SpaceDataService
  ) { }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
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
