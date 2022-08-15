import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { TokenApi } from '@api/token.api';
import { DeviceService } from '@core/services/device';
import { getItem, setItem, StorageItem } from '@core/utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { Token } from '@functions/interfaces/models';
import { UntilDestroy } from '@ngneat/until-destroy';
import { BehaviorSubject, combineLatest, map, Observable, Subscription } from 'rxjs';
import { tokensSections } from '../tokens/tokens.page';

const INITIAL_FAVOURITE_TOKENS = [
  '0x4067ee05ec37ec2e3b135384a0a8cb0db1010af0',
  '0x7eff2c7271851418f792daffe688e662a658950d'
];

@UntilDestroy()
@Component({
  selector: 'wen-favourites',
  templateUrl: './favourites.page.html',
  styleUrls: ['./favourites.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FavouritesPage implements OnInit, OnDestroy {
  public tokens$: BehaviorSubject<Token[] | undefined> = new BehaviorSubject<Token[] | undefined>(undefined);
  public favourites: string[] = [];
  public filteredTokens$: Observable<Token[] | undefined>;
  public filterControl: FormControl;
  public sections = tokensSections;
  public tradingPairsPath = ROUTER_UTILS.config.tokens.tradingPairs;
  private subscriptions$: Subscription[] = [];

  constructor(
    public deviceService: DeviceService,
    private tokenApi: TokenApi
  ) {
    this.filterControl = new FormControl('');
    
    this.filteredTokens$ = combineLatest([this.tokens$, this.filterControl.valueChanges])
      .pipe(
        map(([tokens, filter]) => {
          return tokens?.filter(r => r.name.includes(filter || ''));
        })
      );

    this.favourites = (getItem(StorageItem.FavouriteTokens) || INITIAL_FAVOURITE_TOKENS) as string[];
    setItem(StorageItem.FavouriteTokens, this.favourites);
  }

  public ngOnInit(): void {
    this.listen();
  }

  private listen(): void {
    this.cancelSubscriptions();
    this.tokens$.next(undefined);
    if (!this.favourites?.length) return;
    this.subscriptions$.push(this.tokenApi.listenMultiple(this.favourites).subscribe(tokens => {
      this.tokens$.next(tokens);
      this.filterControl.setValue(this.filterControl.value);
    }));
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return (Array.isArray(arr) && arr.length === 0);
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public favouriteClick(token: Token): void {
    if (this.favourites.includes(token.uid)) {
      this.favourites = this.favourites.filter((t) => t !== token.uid);
    } else {
      this.favourites = [...this.favourites, token.uid];
    }

    setItem(StorageItem.FavouriteTokens, this.favourites);
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
