import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, map, Observable, Subscription } from 'rxjs';
import { Member } from './../../../../../../functions/interfaces/models/member';
import { DEFAULT_LIST_SIZE } from './../../../../@api/base.api';
import { MemberApi } from './../../../../@api/member.api';
import { FilterService, SortOptions } from './../../services/filter.service';

@UntilDestroy()
@Component({
  templateUrl: './members.page.html',
  styleUrls: ['./members.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersPage implements OnInit, OnDestroy {
  public members$: BehaviorSubject<Member[]> = new BehaviorSubject<Member[]>([]);
  private dataStore: Member[][] = [];
  private subscriptions$: Subscription[] = [];
  constructor(private memberApi: MemberApi, public filter: FilterService) {
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

  public getHandler(last?: any): Observable<Member[]> {
    if (this.filter.selectedSort$.value === SortOptions.OLDEST) {
      return this.memberApi.last(last);
    } else {
      return this.memberApi.top(last);
    }
  }

  public onScroll(): void {
    this.subscriptions$.push(this.memberApi.top(this.members$.value[this.members$.value.length - 1].createdOn).subscribe(this.store.bind(this, this.dataStore.length)));
  }

  protected store(page: number, a: any): void {
    if (this.dataStore[page]) {
      this.dataStore[page] = a;
    } else {
      this.dataStore.push(a);
    }

    // Merge arrays.
    this.members$.next(Array.prototype.concat.apply([], this.dataStore));
  }

  public get maxRecords$(): BehaviorSubject<boolean> {
    return <BehaviorSubject<boolean>>this.members$.pipe(map(() => {
      if (!this.dataStore[this.dataStore.length - 1]) {
        return true;
      }

      return (this.dataStore[this.dataStore.length - 1].length < DEFAULT_LIST_SIZE);
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
