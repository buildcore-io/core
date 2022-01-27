import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { FileApi } from '@api/file.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { Member, Space } from "functions/interfaces/models";
import { FILE_SIZES } from './../../../../../../functions/interfaces/models/base';
import { MemberAllianceItem } from './../member-reputation-modal/member-reputation-modal.component';
@Component({
  selector: 'wen-member-space-row',
  templateUrl: './member-space-row.component.html',
  styleUrls: ['./member-space-row.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberSpaceRowComponent {
  @Input() alliances: MemberAllianceItem[] = [];
  @Input() space?: Space;
  @Input() member?: Member;
  @Input() allowReputationModal?: boolean;
  @ViewChild('wrapper', { static: false }) wrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('xpWrapper', { static: false }) xpWrapper?: ElementRef<HTMLDivElement>;
  public get isReputationModalVisible(): boolean {
    return this._isReputationModalVisible;
  }
  public set isReputationModalVisible(value: boolean) {
    this._isReputationModalVisible = value;
    this.reputationModalRightPosition = undefined;
    this.reputationModalBottomPosition = undefined;
    const xpWrapperRect = this.xpWrapper?.nativeElement.getBoundingClientRect();
    const wrapperRect = this.wrapper?.nativeElement.getBoundingClientRect();
    if (this.deviceService.isDesktop$.getValue()) {
      this.reputationModalBottomPosition = window.innerHeight - (xpWrapperRect?.bottom || 0) + (xpWrapperRect?.height || 0) / 2;
      this.reputationModalRightPosition = window.innerWidth - (xpWrapperRect?.right || 0);
      this.reputationModalWidth = undefined;
    } else {
      this.reputationModalRightPosition = window.innerWidth - (wrapperRect?.right || 0);
      this.reputationModalWidth = wrapperRect?.width || 0;
    }
    this.cd.markForCheck();
  }
  public reputationModalBottomPosition?: number;
  public reputationModalRightPosition?: number;
  public reputationModalWidth?: number;
  private _isReputationModalVisible = false;

  constructor(
    public auth: AuthService,
    public deviceService: DeviceService,
    private cd: ChangeDetectorRef
  ) {}

  public getAvatarSize(url?: string|null): string|undefined {
    if (!url) {
      return undefined;
    }

    return FileApi.getUrl(url, 'space_avatar', FILE_SIZES.small);
  }
}
