import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, map, Observable, Subscription } from 'rxjs';
import { Proposal } from './../../../../../../functions/interfaces/models/proposal';
import { DEFAULT_LIST_SIZE } from './../../../../@api/base.api';
import { ProposalApi } from './../../../../@api/proposal.api';
import { FilterService, SortOptions } from './../../services/filter.service';

@UntilDestroy()
@Component({
  templateUrl: './proposals.page.html',
  styleUrls: ['./proposals.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush

})
export class ProposalsPage implements OnInit, OnDestroy {
  public proposal$: BehaviorSubject<Proposal[]> = new BehaviorSubject<Proposal[]>([]);
  private dataStore: Proposal[][] = [];
  private subscriptions$: Subscription[] = [];
  constructor(private proposalApi: ProposalApi, public filter: FilterService) {
    // none.
  }

  public ngOnInit(): void {
    this.listen();
    this.filter.selectedSort$.pipe(untilDestroyed(this)).subscribe(() => {
      this.listen();
    });
  }

  private listen(): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.getHandler().subscribe(this.store.bind(this, 0)));
  }

  public getHandler(last?: any): Observable<Proposal[]> {
    if (this.filter.selectedSort$.value === SortOptions.OLDEST) {
      return this.proposalApi.last(last);
    } else {
      return this.proposalApi.top(last);
    }
  }

  public onScroll(): void {
    this.subscriptions$.push(this.proposalApi.top(this.proposal$.value[this.proposal$.value.length - 1].createdOn).subscribe(this.store.bind(this, this.dataStore.length)));
  }

  protected store(page: number, a: any): void {
    if (this.dataStore[page]) {
      this.dataStore[page] = a;
    } else {
      this.dataStore.push(a);
    }

    // Merge arrays.
    this.proposal$.next(Array.prototype.concat.apply([], this.dataStore));
  }

  public get maxRecords$(): BehaviorSubject<boolean> {
    return <BehaviorSubject<boolean>>this.proposal$.pipe(map(() => {
      if (!this.dataStore[this.dataStore.length - 1]) {
        return true;
      }

      return (this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE);
    }));
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });

    this.dataStore = [];
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
