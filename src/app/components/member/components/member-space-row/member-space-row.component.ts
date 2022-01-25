import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';

@Component({
  selector: 'wen-member-space-row',
  templateUrl: './member-space-row.component.html',
  styleUrls: ['./member-space-row.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberSpaceRowComponent {
  @Input() space: any;
  @Input() allowReputationModal?: boolean;
  
  @ViewChild('xpWrapper', { static: false }) xpWrapper?: ElementRef<HTMLDivElement>;

  public get isReputationModalVisible(): boolean {
    return this._isReputationModalVisible;
  }
  public set isReputationModalVisible(value: boolean) {
    this._isReputationModalVisible = value;
    this.reputationModalRightPosition = undefined;
    this.reputationModalBottomPosition = undefined;
    const wrapperRect = this.xpWrapper?.nativeElement.getBoundingClientRect();
    const wrapperRight = wrapperRect?.right || 0;
    const wrapperBottom = wrapperRect?.bottom || 0;
    this.reputationModalBottomPosition = window.innerHeight - wrapperBottom + (wrapperRect?.height || 0) / 2;
    this.reputationModalRightPosition = window.innerWidth - wrapperRight;

    this.cd.markForCheck();
  }
  
  private _isReputationModalVisible = false;
  public reputationModalBottomPosition?: number;
  public reputationModalRightPosition?: number;

  constructor(
    public auth: AuthService,
    private cd: ChangeDetectorRef
  ) {}
}
