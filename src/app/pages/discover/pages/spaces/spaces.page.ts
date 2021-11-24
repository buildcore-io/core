import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Space } from "functions/interfaces/models";
import { BehaviorSubject, map, Observable, Subscription } from 'rxjs';
import { DEFAULT_LIST_SIZE } from './../../../../@api/base.api';
import { SpaceApi } from './../../../../@api/space.api';
import { FilterService, SortOptions } from './../../services/filter.service';

@UntilDestroy()
@Component({
  templateUrl: './spaces.page.html',
  styleUrls: ['./spaces.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpacesPage implements OnInit, OnDestroy {
  public spaces$: BehaviorSubject<Space[]> = new BehaviorSubject<Space[]>([]);
  private dataStore: Space[][] = [];
  private subscriptions$: Subscription[] = [];

  constructor(private spaceApi: SpaceApi, public filter: FilterService) {
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

  public getHandler(last?: any): Observable<Space[]> {
    if (this.filter.selectedSort$.value === SortOptions.OLDEST) {
      return this.spaceApi.last(last);
    } else {
      return this.spaceApi.top(last);
    }
  }

  public onScroll(): void {
    if (this.dataStore[this.dataStore.length - 1].length < DEFAULT_LIST_SIZE) {
      // Finished paging.
      return;
    }

    this.subscriptions$.push(this.getHandler(this.spaces$.value[this.spaces$.value.length - 1].createdOn).subscribe(this.store.bind(this, this.dataStore.length)));
  }

  protected store(page: number, a: any): void {
    if (this.dataStore[page]) {
      this.dataStore[page] = a;
    } else {
      this.dataStore.push(a);
    }

    // Merge arrays.
    this.spaces$.next(Array.prototype.concat.apply([], this.dataStore));
  }

  public get maxRecords$(): BehaviorSubject<boolean> {
    return <BehaviorSubject<boolean>>this.spaces$.pipe(map(() => {
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
