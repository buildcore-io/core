import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MemberApi } from "@api/member.api";
import { DeviceService } from '@core/services/device';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, combineLatest, debounceTime } from "rxjs";
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
export class MemberCardComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() member?: Member;
  @Input() fullWidth?: boolean;
  @Input() about?: string;
  @Input() role?: string;
  @Input() allowReputationModal?: boolean;

  @ViewChild('xpWrapper', { static: false }) xpWrapper?: ElementRef<HTMLDivElement>;

  public badges$: BehaviorSubject<Transaction[]|undefined> = new BehaviorSubject<Transaction[]|undefined>(undefined);
  public path = ROUTER_UTILS.config.member.root;
  public isReputationModalVisible = false;
  public reputationModalBottomPosition?: number;
  public reputationModalLeftPosition?: number;
  public reputationModalRightPosition?: number;

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

  public ngAfterViewInit(): void {
    combineLatest([this.deviceService.innerWidth$, this.deviceService.scrollY$])
      .pipe(
        debounceTime(20),
        untilDestroyed(this)
      )
      .subscribe(([width, scrollY]) => {
        this.setModalPositions();
      });
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public setIsReputationModalVisible(value: boolean): void {
    console.log(value);
    if(!this.allowReputationModal) return;
    this.isReputationModalVisible = value;
    this.cd.markForCheck();
  }

  private setModalPositions(): void {
    this.reputationModalLeftPosition = undefined;
    this.reputationModalRightPosition = undefined;
    this.reputationModalBottomPosition = undefined;
    const wrapperRect = this.xpWrapper?.nativeElement.getBoundingClientRect();
    const wrapperLeft = wrapperRect?.left || 0;
    const wrapperRight = wrapperRect?.right || 0;
    const wrapperBottom = wrapperRect?.bottom || 0;
    this.reputationModalBottomPosition = window.innerHeight - wrapperBottom + (wrapperRect?.height || 0) + window.scrollY;
    if (wrapperLeft <= window.innerWidth / 2) {
      this.reputationModalLeftPosition = wrapperLeft;
    } else  {
      this.reputationModalRightPosition = window.innerWidth - wrapperRight;
    }
    
    this.cd.markForCheck();
  }

  public ngOnDestroy(): void {
    this.badges$.next(undefined);
  }
}
