import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { AvatarService } from '@core/services/avatar';
import { DeviceService } from '@core/services/device';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { Member, Space } from "functions/interfaces/models";
@Component({
  selector: 'wen-member-space-row',
  templateUrl: './member-space-row.component.html',
  styleUrls: ['./member-space-row.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberSpaceRowComponent {
  @Input() space?: Space;
  @Input() member?: Member;
  @Input() includeAlliances?: boolean;

  public isReputationVisible = false;

  constructor(
    public deviceService: DeviceService,
    public avatarService: AvatarService,
    private cd: ChangeDetectorRef
  ) {}

  public getSpaceRoute(): string[] {
    return ['/', ROUTER_UTILS.config.space.root, this.space?.uid || ''];
  }
}
