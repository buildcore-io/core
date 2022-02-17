import { Injectable } from '@angular/core';
import { MemberApi } from '@api/member.api';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Award, Space } from 'functions/interfaces/models';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { Member } from './../../../../../functions/interfaces/models/member';
import { Transaction } from './../../../../../functions/interfaces/models/transaction';
import { FULL_LIST } from './../../../@api/base.api';
import { TransactionApi } from './../../../@api/transaction.api';

@UntilDestroy()
@Injectable()
export class DataService {
  public member$: BehaviorSubject<Member|undefined> = new BehaviorSubject<Member|undefined>(undefined);
  public awardsCompleted$: BehaviorSubject<Award[]|undefined> = new BehaviorSubject<Award[]|undefined>(undefined);
  public awardsPending$: BehaviorSubject<Award[]|undefined> = new BehaviorSubject<Award[]|undefined>(undefined);
  public badges$: BehaviorSubject<Transaction[]|undefined> = new BehaviorSubject<Transaction[]|undefined>(undefined);
  public space$: BehaviorSubject<Space[]|undefined> = new BehaviorSubject<Space[]|undefined>(undefined);
  public lastLoadedAllBadges = false;

  constructor(
    private memberApi: MemberApi,
    private tranApi: TransactionApi
  ) {
    // none.
  }

  public async refreshBadges(selectedSpace: Space | undefined, includeAlliances: boolean): Promise<void> {
    if (this.member$.value?.uid) {
      if (!selectedSpace) {
        // Already loaded. Do nothing. Reduce network requests.
        if (this.lastLoadedAllBadges) {
          return;
        }

        // TODO implement paging.
        this.lastLoadedAllBadges = true;
        this.memberApi.topBadges(this.member$.value.uid, 'createdOn', undefined, FULL_LIST).pipe(untilDestroyed(this)).subscribe(this.badges$);
      } else {
        this.lastLoadedAllBadges = false;
        this.badges$.next(undefined);
        const allBadges: string[] = [...(this.member$.value.spaces?.[selectedSpace!.uid]?.badges || [])];
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

  public resetSubjects(): void {
    // Clean up all streams.
    this.member$.next(undefined);
    this.awardsCompleted$.next(undefined);
    this.awardsPending$.next(undefined);
    this.badges$.next(undefined);
    this.space$.next(undefined);
  }
}
