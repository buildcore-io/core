import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MemberApi } from "@api/member.api";
import { DeviceService } from '@core/services/device';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject } from "rxjs";
import { Transaction } from "../../../../../../functions/interfaces/models";
import { FILE_SIZES } from "../../../../../../functions/interfaces/models/base";
import { Member } from '../../../../../../functions/interfaces/models/member';
import { ROUTER_UTILS } from './../../../../@core/utils/router.utils';

@UntilDestroy()
@Component({
  selector: 'wen-member-card',
  templateUrl: './member-card.component.html',
  styleUrls: ['./member-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberCardComponent implements OnInit, OnDestroy {
  @Input() member?: Member;
  @Input() fullWidth?: boolean;
  @Input() about?: string;
  @Input() role?: string;
  @Input() allowReputationModal?: boolean;

  @ViewChild('xpWrapper', { static: false }) xpWrapper?: ElementRef<HTMLDivElement>;

  public get isReputationModalVisible(): boolean {
    return this._isReputationModalVisible;
  }
  public set isReputationModalVisible(value: boolean) {
    this._isReputationModalVisible = value;
    this.reputationModalLeftPosition = undefined;
    this.reputationModalRightPosition = undefined;
    this.reputationModalBottomPosition = undefined;
    const wrapperRect = this.xpWrapper?.nativeElement.getBoundingClientRect();
    this.reputationModalBottomPosition = window.innerHeight - (wrapperRect?.bottom || 0) + (wrapperRect?.height || 0);
    if ((wrapperRect?.left || 0) <= window.innerWidth / 2) {
      this.reputationModalLeftPosition = wrapperRect?.left || 0;
    } else  {
      this.reputationModalRightPosition = window.innerWidth - (wrapperRect?.right || 0);
    }

    this.cd.markForCheck();
  }

  public badges$: BehaviorSubject<Transaction[]|undefined> = new BehaviorSubject<Transaction[]|undefined>(undefined);
  public path = ROUTER_UTILS.config.member.root;
  public reputationModalBottomPosition?: number;
  public reputationModalLeftPosition?: number;
  public reputationModalRightPosition?: number;
  private _isReputationModalVisible = false;

  constructor(
    private memberApi: MemberApi,
    private cd: ChangeDetectorRef,
    public deviceService: DeviceService
  ) {
    // none.
  }

  public ngOnInit(): void {
    if (this.member?.uid) {
      this.memberApi.topBadges(this.member.uid).pipe(untilDestroyed(this)).subscribe(this.badges$);
    }
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public ngOnDestroy(): void {
    this.badges$.next(undefined);
  }
}
