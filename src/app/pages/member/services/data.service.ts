import { Injectable } from '@angular/core';
import { MemberApi } from '@api/member.api';
import { Award, Space } from '@functions/interfaces/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, firstValueFrom, Subscription } from 'rxjs';
import { Member } from './../../../../../functions/interfaces/models/member';
import { Transaction } from './../../../../../functions/interfaces/models/transaction';
import { FULL_TODO_CHANGE_TO_PAGING } from './../../../@api/base.api';
import { TransactionApi } from './../../../@api/transaction.api';

@UntilDestroy()
@Injectable({
  providedIn: 'any'
})
export class DataService {
  public member$: BehaviorSubject<Member | undefined> = new BehaviorSubject<Member | undefined>(undefined);
  public awardsCompleted$: BehaviorSubject<Award[] | undefined> = new BehaviorSubject<Award[] | undefined>(undefined);
  public awardsPending$: BehaviorSubject<Award[] | undefined> = new BehaviorSubject<Award[] | undefined>(undefined);
  public badges$: BehaviorSubject<Transaction[] | undefined> = new BehaviorSubject<Transaction[] | undefined>(undefined);
  public spaces$: BehaviorSubject<Space[] | undefined> = new BehaviorSubject<Space[] | undefined>(undefined);
  public space$: BehaviorSubject<Space[] | undefined> = new BehaviorSubject<Space[] | undefined>(undefined);
  public lastLoadedMemberId?: string;
  public subscriptions$: Subscription[] = [];

  constructor(
    private memberApi: MemberApi,
    private tranApi: TransactionApi
  ) {
    // none.
  }

  public async refreshBadges(selectedSpace: Space | undefined, includeAlliances: boolean): Promise<void> {
    this.cancelSubscriptions();
    if (this.member$.value?.uid) {
      if (!selectedSpace) {
        // Already loaded. Do nothing. Reduce network requests.
        if (this.lastLoadedMemberId === this.member$.value.uid) {
          return;
        }

        // TODO implement paging.
        this.lastLoadedMemberId = this.member$.value.uid
        this.subscriptions$.push(
          this.memberApi.topBadges(this.member$.value.uid, 'createdOn', undefined, FULL_TODO_CHANGE_TO_PAGING).pipe(untilDestroyed(this)).subscribe(this.badges$)
        );
      } else {
        this.lastLoadedMemberId = undefined;
        this.badges$.next(undefined);
        if (selectedSpace) {
          const allBadges: string[] = [...(this.member$.value.spaces?.[selectedSpace.uid]?.badges || [])];
          if (includeAlliances) {
            for (const [spaceId] of Object.entries(selectedSpace?.alliances || {})) {
              allBadges.push(...(this.member$.value.spaces?.[spaceId]?.badges || []));
            }
          }
          // Let's get first 6 badges.
          const finalBadgeTransactions: Transaction[] = [];
          for (const tran of allBadges) {
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

  public resetSubjects(): void {
    // Clean up all streams.
    this.member$.next(undefined);
    this.awardsCompleted$.next(undefined);
    this.awardsPending$.next(undefined);
    this.badges$.next(undefined);
    this.spaces$.next(undefined);
    this.space$.next(undefined);
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }
}
