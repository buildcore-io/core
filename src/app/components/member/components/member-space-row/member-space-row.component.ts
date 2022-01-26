import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';

@Component({
  selector: 'wen-member-space-row',
  templateUrl: './member-space-row.component.html',
  styleUrls: ['./member-space-row.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberSpaceRowComponent {
  @Input() space: any;
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
    console.log(wrapperRect, this.reputationModalRightPosition,);
    this.cd.markForCheck();
  }
  
  private _isReputationModalVisible = false;
  public reputationModalBottomPosition?: number;
  public reputationModalRightPosition?: number;
  public reputationModalWidth?: number;

  constructor(
    public auth: AuthService,
    public deviceService: DeviceService,
    private cd: ChangeDetectorRef
  ) {}
}
