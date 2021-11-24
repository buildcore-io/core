import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, map, Observable, Subscription } from 'rxjs';
import { Award } from './../../../../../../functions/interfaces/models/award';
import { AwardApi } from './../../../../@api/award.api';
import { DEFAULT_LIST_SIZE } from './../../../../@api/base.api';
import { FilterService, SortOptions } from './../../services/filter.service';

@UntilDestroy()
@Component({
  templateUrl: './awards.page.html',
  styleUrls: ['./awards.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush

})
export class AwardsPage implements OnInit, OnDestroy {
  public award$: BehaviorSubject<Award[]> = new BehaviorSubject<Award[]>([]);
  private dataStore: Award[][] = [];
  private subscriptions$: Subscription[] = [];
  constructor(private awardApi: AwardApi, public filter: FilterService) {
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

  public getHandler(last?: any): Observable<Award[]> {
    if (this.filter.selectedSort$.value === SortOptions.OLDEST) {
      return this.awardApi.last(last);
    } else {
      return this.awardApi.top(last);
    }
  }

  public onScroll(): void {
    this.subscriptions$.push(this.awardApi.top(this.award$.value[this.award$.value.length - 1].createdOn).subscribe(this.store.bind(this, this.dataStore.length)));
  }

  protected store(page: number, a: any): void {
    if (this.dataStore[page]) {
      this.dataStore[page] = a;
    } else {
      this.dataStore.push(a);
    }

    // Merge arrays.
    this.award$.next(Array.prototype.concat.apply([], this.dataStore));
  }

  public get maxRecords$(): BehaviorSubject<boolean> {
    return <BehaviorSubject<boolean>>this.award$.pipe(map(() => {
      if (!this.dataStore[this.dataStore.length - 1]) {
        return true;
      }

      return (!this.dataStore[this.dataStore.length - 1] || this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE);
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
