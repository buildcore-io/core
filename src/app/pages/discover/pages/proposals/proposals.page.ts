import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DeviceService } from '@core/services/device';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, map, Observable, skip, Subscription } from 'rxjs';
import { SortOptions } from "../../services/sort-options.interface";
import { Proposal } from './../../../../../../functions/interfaces/models/proposal';
import { DEFAULT_LIST_SIZE } from './../../../../@api/base.api';
import { ProposalApi } from './../../../../@api/proposal.api';
import { FilterService } from './../../services/filter.service';
import {discoverSections} from "@pages/discover/pages/discover/discover.page";
import {defaultPaginationItems} from "@Algolia/algolia.options";
import {AlgoliaService} from "@Algolia/services/algolia.service";
import {Timestamp} from "firebase/firestore";

export enum HOT_TAGS {
  ALL = 'All',
  ACTIVE = 'Active',
  COMPLETED = 'Completed'
}

@UntilDestroy()
@Component({
  templateUrl: './proposals.page.html',
  styleUrls: ['./proposals.page.less'],
  // changeDetection: ChangeDetectionStrategy.OnPush
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Default

})
export class ProposalsPage implements OnInit, OnDestroy {
  config = {
    indexName: 'proposal',
    searchClient: this.algoliaService.searchClient,
  };
  sections = discoverSections;
  sortItems = [
    { value: 'proposal', label: 'Recent' },
    { value: 'proposal_createdOn_desc', label: 'Oldest' },
  ];
  paginationItems = defaultPaginationItems;

  public sortControl: FormControl;
  public proposal$: BehaviorSubject<Proposal[]|undefined> = new BehaviorSubject<Proposal[]|undefined>(undefined);
  public hotTags: string[] = [HOT_TAGS.ALL, HOT_TAGS.ACTIVE, HOT_TAGS.COMPLETED];
  public selectedTags$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([HOT_TAGS.ACTIVE]);
  private dataStore: Proposal[][] = [];
  private subscriptions$: Subscription[] = [];
  constructor(
    private proposalApi: ProposalApi,
    public filter: FilterService,
    public deviceService: DeviceService,
    public readonly algoliaService: AlgoliaService,
  ) {
    this.sortControl = new FormControl(this.filter.selectedSort$.value);
  }

  public ngOnInit(): void {
    this.filter.selectedSort$.pipe(skip(1), untilDestroyed(this)).subscribe(() => {
      if (this.filter.search$.value && this.filter.search$.value.length > 0) {
        this.listen(this.filter.search$.value);
      } else {
        this.listen();
      }
    });

    this.filter.search$.pipe(skip(1), untilDestroyed(this)).subscribe((val: any) => {
      if (val && val.length > 0) {
        this.listen(val);
      } else {
        this.listen();
      }
    });

    this.sortControl.valueChanges.pipe(untilDestroyed(this)).subscribe((val: any) => {
      this.filter.selectedSort$.next(val);
    });

    // Init listen.
    this.selectedTags$.pipe(untilDestroyed(this)).subscribe(() => {
      if (this.filter.search$.value && this.filter.search$.value.length > 0) {
        this.listen(this.filter.search$.value);
      } else {
        this.listen();
      }
    });
  }

  public handleChange(tag: string): void {
    this.selectedTags$.next([tag]);
  }

  private listen(search?: string): void {
    this.cancelSubscriptions();
    this.proposal$.next(undefined);
    this.subscriptions$.push(this.getHandler(undefined, search).subscribe(this.store.bind(this, 0)));
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return (Array.isArray(arr) && arr.length === 0);
  }

  public getHandler(last?: any, search?: string): Observable<Proposal[]> {
    if (this.selectedTags$.value[0] === HOT_TAGS.ACTIVE) {
      if (this.filter.selectedSort$.value === SortOptions.OLDEST) {
        return this.proposalApi.lastActive(last, search);
      } else {
        return this.proposalApi.topActive(last, search);
      }
    } else if (this.selectedTags$.value[0] === HOT_TAGS.COMPLETED) {
      if (this.filter.selectedSort$.value === SortOptions.OLDEST) {
        return this.proposalApi.lastCompleted(last, search);
      } else {
        return this.proposalApi.topCompleted(last, search);
      }
    } else {
      if (this.filter.selectedSort$.value === SortOptions.OLDEST) {
        return this.proposalApi.last(last, search);
      } else {
        return this.proposalApi.top(last, search);
      }
    }
  }

  public onScroll(): void {
    // In this case there is no value, no need to infinite scroll.
    if (!this.proposal$.value) {
      return;
    }

    // We reached maximum.
    if ((!this.dataStore[this.dataStore.length - 1] || this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE)) {
      return;
    }

    this.subscriptions$.push(this.getHandler(this.proposal$.value[this.proposal$.value.length - 1]._doc).subscribe(this.store.bind(this, this.dataStore.length)));
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
    return <BehaviorSubject<boolean>> this.proposal$.pipe(map(() => {
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

  public convertAllToSoonaverseModel(algoliaItems: any[]) {

    return algoliaItems.map(algolia => ({
      ...algolia,
      createdOn: Timestamp.fromMillis(+algolia.createdOn),
      updatedOn: Timestamp.fromMillis(+algolia.updatedOn),
      lastmodified: Timestamp.fromMillis(+algolia.lastmodified),
      settings: {...algolia.settings, startDate: Timestamp.fromMillis(+algolia.settings.startDate), endDate: Timestamp.fromMillis(+algolia.settings.endDate)}
    }));
  }

}
