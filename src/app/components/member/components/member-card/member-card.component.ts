/* eslint-disable @typescript-eslint/adjacent-overload-signatures */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import { MemberApi } from "@api/member.api";
import { TransactionApi } from "@api/transaction.api";
import { DeviceService } from '@core/services/device';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { Space, Transaction } from "../../../../../../functions/interfaces/models";
import { FILE_SIZES } from "../../../../../../functions/interfaces/models/base";
import { Member } from '../../../../../../functions/interfaces/models/member';
import { CacheService } from './../../../../@core/services/cache/cache.service';
import { ROUTER_UTILS } from './../../../../@core/utils/router.utils';

@UntilDestroy()
@Component({
  selector: 'wen-member-card',
  templateUrl: './member-card.component.html',
  styleUrls: ['./member-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberCardComponent implements OnDestroy {
  @Input()
  public set selectedSpace(value: string | undefined) {
    this._selectedSpace = value;
    this.refreshBadges();
  }

  @Input() includeAlliances = false;
  @Input() member?: Member;
  @Input() fullWidth?: boolean;
  @Input() about?: string;
  @Input() role?: string;
  @Input() allowReputationModal?: boolean;

  @ViewChild('xpWrapper', { static: false }) xpWrapper?: ElementRef<HTMLDivElement>;
  public get isReputationVisible(): boolean {
    return this._isReputationVisible;
  }
  public get selectedSpace(): string | undefined {
    return this._selectedSpace;
  }

  public set isReputationVisible(value: boolean) {
    this._isReputationVisible = value;
    if (this.deviceService.isDesktop$.getValue()) {
      this.reputationModalLeftPosition = undefined;
      this.reputationModalRightPosition = undefined;
      this.reputationModalBottomPosition = undefined;
      const xpWrapperRect = this.xpWrapper?.nativeElement.getBoundingClientRect();
      this.reputationModalBottomPosition = window.innerHeight - (xpWrapperRect?.bottom || 0) + (xpWrapperRect?.height || 0);
      if ((xpWrapperRect?.left || 0) <= window.innerWidth / 2) {
        this.reputationModalLeftPosition = xpWrapperRect?.left || 0;
      } else  {
        this.reputationModalRightPosition = window.innerWidth - (xpWrapperRect?.right || 0);
      }
    }

    this.cd.markForCheck();
  }

  public badges$: BehaviorSubject<Transaction[]|undefined> = new BehaviorSubject<Transaction[]|undefined>(undefined);
  public totalVisibleBadges = 6;
  public path = ROUTER_UTILS.config.member.root;
  public reputationModalBottomPosition?: number;
  public reputationModalLeftPosition?: number;
  public reputationModalRightPosition?: number;
  private _isReputationVisible = false;
  private _selectedSpace?: string;

  constructor(
    private memberApi: MemberApi,
    private tranApi: TransactionApi,
    private cd: ChangeDetectorRef,
    private cache: CacheService,
    public deviceService: DeviceService
  ) {
    // none.
  }

  public async refreshBadges(): Promise<void> {
    if (this.member?.uid) {
      if (!this.getSelectedSpace()) {
        this.memberApi.topBadges(this.member.uid).pipe(untilDestroyed(this)).subscribe(this.badges$);
      } else {
        this.badges$.next(undefined);
        const allBadges: string[] = this.member?.spaces?.[this.getSelectedSpace()!.uid]?.badges || [];
        for (const [spaceId] of Object.entries(this.getSelectedSpace()?.alliances || {})) {
          allBadges.push(...(this.member.spaces?.[spaceId]?.badges || []));
        }

        // Let's get first 6 badges.
        const finalBadgeTransactions: Transaction[] = [];
        for (const tran of allBadges.slice(0, this.totalVisibleBadges)) {
          const obj: Transaction | undefined = await firstValueFrom(this.tranApi.listen(tran));
          if (obj) {
            finalBadgeTransactions.push(obj);
          }
        }

        this.badges$.next(finalBadgeTransactions);
      }
    }
  }

  public getSelectedSpace(): Space | undefined {
    return this.cache.allSpaces$.value.find((s) => {
      return s.uid === this._selectedSpace;
    });
  }

  public getTotal(what: 'awardsCompleted'|'totalReputation'): number { // awardsCompleted
    let total = 0;
    if (!this.getSelectedSpace()) {
      total = this.member?.[what] || 0;
    } else {
      total = this.member?.spaces?.[this.getSelectedSpace()!.uid]?.[what] || 0;
      if (this.includeAlliances) {
        for (const [spaceId, values] of Object.entries(this.getSelectedSpace()?.alliances || {})) {
          const allianceSpace: Space | undefined = this.cache.allSpaces$.value.find((s) => {
            return s.uid === spaceId;
          });
          if (allianceSpace && values.enabled === true ) {
            const value: number = this.member?.spaces?.[allianceSpace.uid]?.[what] || 0;
            total += Math.trunc((what === 'totalReputation') ? (value * values.weight) : value);
          }
        }
      }
    }

    return Math.trunc(total);
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public ngOnDestroy(): void {
    this.badges$.next(undefined);
  }
}
