import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DEFAULT_LIST_SIZE } from '@api/base.api';
import { TokenApi } from '@api/token.api';
import { AlgoliaService } from '@components/algolia/services/algolia.service';
import { DeviceService } from '@core/services/device';
import { FilterStorageService } from '@core/services/filter-storage';
import { GLOBAL_DEBOUNCE_TIME } from "@functions/interfaces/config";
import { Token } from '@functions/interfaces/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { InstantSearchConfig } from 'angular-instantsearch/instantsearch/instantsearch';
import { Timestamp } from 'firebase/firestore';
import { BehaviorSubject, debounceTime, Observable, Subscription } from 'rxjs';
import { tokensSections } from '../tokens/tokens.page';

@UntilDestroy()
@Component({
  selector: 'wen-all-tokens',
  templateUrl: './all-tokens.page.html',
  styleUrls: ['./all-tokens.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AllTokensPage implements OnInit, OnDestroy {
  public tokens$: BehaviorSubject<Token[] | undefined> = new BehaviorSubject<Token[] | undefined>(undefined);
  private dataStore: Token[][] = [];
  public filterControl: FormControl;
  public sections = tokensSections;
  public config: InstantSearchConfig;
  private subscriptions$: Subscription[] = [];

  constructor(
    public deviceService: DeviceService,
    public filterStorageService: FilterStorageService,
    public algoliaService: AlgoliaService,
    private tokenApi: TokenApi,
    private cd: ChangeDetectorRef
  ) {
    this.filterControl = new FormControl('');
    
    this.config = {
      indexName: 'token',
      searchClient: this.algoliaService.searchClient,
      initialUiState: {
        token: this.filterStorageService.tokensAllTokensFilters$.value
      }
    };
  }

  public ngOnInit(): void {
    this.listen();
    this.filterControl.valueChanges.pipe(untilDestroyed(this), debounceTime(GLOBAL_DEBOUNCE_TIME)).subscribe((val: any) => {
      if (val && val.length > 0) {
        this.listen(val);
      } else {
        this.listen();
      }
    });
  }

  private listen(search?: string): void {
    this.cancelSubscriptions();
    this.tokens$.next(undefined);
    this.subscriptions$.push(this.getHandler(undefined, search).subscribe(this.store.bind(this, 0)));
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return (Array.isArray(arr) && arr.length === 0);
  }

  public getHandler(last?: any, search?: string): Observable<Token[]> {
    return this.tokenApi.allPairs(last, search);
  }

  public onScroll(): void {
    // In this case there is no value, no need to infinite scroll.
    if (!this.tokens$.value) {
      return;
    }

    // We reached maximum.
    if ((!this.dataStore[this.dataStore.length - 1] || this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE)) {
      return;
    }

    // Def order field.
    const lastValue = this.tokens$.value[this.tokens$.value.length - 1]._doc;
    this.subscriptions$.push(this.getHandler(lastValue).subscribe(this.store.bind(this, this.dataStore.length)));
  }

  protected store(page: number, a: any): void {
    if (this.dataStore[page]) {
      this.dataStore[page] = a;
    } else {
      this.dataStore.push(a);
    }

    // Merge arrays.
    this.tokens$.next(Array.prototype.concat.apply([], this.dataStore));
    this.cd.markForCheck();
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public convertAllToSoonaverseModel(algoliaItems: any[]) {
    return algoliaItems.map(algolia => ({
      ...algolia,
      createdOn: Timestamp.fromMillis(+algolia.createdOn),
      mintedClaimedOn: Timestamp.fromMillis(+algolia.mintedClaimedOn)
    }));
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
