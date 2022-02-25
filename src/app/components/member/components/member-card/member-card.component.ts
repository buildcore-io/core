/* eslint-disable @typescript-eslint/adjacent-overload-signatures */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy } from '@angular/core';
import { MemberApi } from "@api/member.api";
import { TransactionApi } from "@api/transaction.api";
import { DeviceService } from '@core/services/device';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, first, firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Space, Transaction } from "../../../../../../functions/interfaces/models";
import { FILE_SIZES, Timestamp } from "../../../../../../functions/interfaces/models/base";
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
  public set selectedSpace(value: Space |  string | undefined) {
    this._selectedSpace = typeof value === 'string' ?
      this.cache.allSpaces$.getValue().find((s) => s.uid === value) : value;
    this.refreshBadges();
  }

  @Input()
  public set includeAlliances(value: boolean) {
    this._includeAlliances = value;
    this.refreshBadges();
  }
  @Input() member?: Member;
  @Input() fullWidth?: boolean;
  @Input() about?: string;
  @Input() role?: string;
  @Input() createdOn?: Timestamp;
  @Input() createdOnLabel = 'joined';

  public get selectedSpace(): Space | undefined {
    return this._selectedSpace;
  }
  public get includeAlliances(): boolean {
    return this._includeAlliances;
  }

  public badges$: BehaviorSubject<Transaction[]|undefined> = new BehaviorSubject<Transaction[]|undefined>(undefined);
  public totalVisibleBadges = 6;
  public path = ROUTER_UTILS.config.member.root;
  public isReputationVisible = false;
  private _selectedSpace?: Space;
  private _includeAlliances = false;

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
      if (!this.selectedSpace) {
        this.memberApi.topBadges(this.member.uid)
          .pipe(
            first(),
            filter(() => !this.selectedSpace),
            untilDestroyed(this)
          )
          .subscribe(this.badges$);
      } else {
        this.badges$.next(undefined);
        const allBadges: string[] = [...(this.member?.spaces?.[this.selectedSpace!.uid]?.badges || [])];
        if (this.includeAlliances) {
          for (const [spaceId] of Object.entries(this.selectedSpace?.alliances || {})) {
            allBadges.push(...(this.member.spaces?.[spaceId]?.badges || []));
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

  public getTotal(what: 'awardsCompleted'|'totalReputation'): number { // awardsCompleted
    let total = 0;
    if (!this.selectedSpace) {
      total = this.member?.[what] || 0;
    } else {
      total = this.member?.spaces?.[this.selectedSpace!.uid]?.[what] || 0;
      if (this.includeAlliances) {
        for (const [spaceId, values] of Object.entries(this.selectedSpace?.alliances || {})) {
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
