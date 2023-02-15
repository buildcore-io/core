/* eslint-disable @typescript-eslint/adjacent-overload-signatures */
import { ChangeDetectionStrategy, Component, Input, OnDestroy } from '@angular/core';
import { MemberApi } from '@api/member.api';
import { TransactionApi } from '@api/transaction.api';
import { DeviceService } from '@core/services/device';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { FILE_SIZES, Member, Space, Timestamp, Transaction } from '@soonaverse/interfaces';
import { BehaviorSubject, first, firstValueFrom, Observable, of } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ROUTER_UTILS } from './../../../../@core/utils/router.utils';

@UntilDestroy()
@Component({
  selector: 'wen-member-card',
  templateUrl: './member-card.component.html',
  styleUrls: ['./member-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberCardComponent implements OnDestroy {
  @Input()
  public set selectedSpace(value: Space | undefined) {
    this._selectedSpace = value;
    this.refreshBadges();
  }

  @Input() member?: Member;
  @Input() fullWidth?: boolean;
  @Input() allowMobileContent?: boolean;
  @Input() about?: string;
  @Input() role?: string;
  @Input() createdOn?: Timestamp;
  @Input() createdOnLabel = 'joined';

  public get selectedSpace(): Space | undefined {
    return this._selectedSpace;
  }

  public badges$: BehaviorSubject<Transaction[] | undefined> = new BehaviorSubject<
    Transaction[] | undefined
  >(undefined);
  public totalVisibleBadges = 6;
  public path = ROUTER_UTILS.config.member.root;
  public isReputationVisible = false;
  private _selectedSpace?: Space;

  constructor(
    private memberApi: MemberApi,
    private tranApi: TransactionApi,
    public deviceService: DeviceService,
  ) {
    // none.
  }

  public async refreshBadges(): Promise<void> {
    if (this.member?.uid) {
      if (!this.selectedSpace) {
        this.memberApi
          .topBadges(this.member.uid)
          .pipe(
            first(),
            filter(() => !this.selectedSpace),
            untilDestroyed(this),
          )
          .subscribe(this.badges$);
      } else {
        this.badges$.next(undefined);
        if (this.selectedSpace) {
          const allBadges: string[] = [];
          const stat = this.member?.spaces?.[this.selectedSpace.uid]?.awardStat || {};
          for (const p in stat) {
            if (Object.prototype.hasOwnProperty.call(stat, p)) {
              allBadges.concat(stat[p].badges);
            }
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
  }

  public getTotal(): Observable<number> {
    if (!this.selectedSpace) {
      const stat = this.member?.spaces || {};
      let total = 0;
      for (const p in stat) {
        if (Object.prototype.hasOwnProperty.call(stat, p)) {
          total += stat[p].awardsCompleted || 0;
        }
      }

      return of(Math.trunc(total));
    }

    return of(
      Math.trunc(this.member?.spaces?.[this.selectedSpace?.uid || 0]?.awardsCompleted || 0),
    );
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public ngOnDestroy(): void {
    this.badges$.next(undefined);
  }
}
