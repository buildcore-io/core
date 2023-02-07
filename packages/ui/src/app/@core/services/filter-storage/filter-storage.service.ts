import { Injectable } from '@angular/core';
import { flattenObj } from '@core/utils/manipulations.utils';
import { TokenStatus } from '@soonaverse/interfaces';
import { BehaviorSubject, map } from 'rxjs';

export interface DiscoverSpacesFilters {
  sortBy: string;
}

export interface DiscoverAwardsFilters {
  sortBy: string;
}

export interface DiscoverCollectionsFilters {
  sortBy: string;
  refinementList?: {
    space?: string[];
  };
}

export interface DiscoverMembersFilters {
  sortBy: string;
}

export interface DiscoverProposalsFilters {
  sortBy: string;
}

export interface MarketNftsFilters {
  sortBy: string;
  refinementList?: {
    available?: string[];
    space?: string[];
    collection?: string[];
  };
  range?: {
    availablePrice: string;
  };
}

export interface MarketCollectionsFilters {
  sortBy: string;
  refinementList?: {
    access?: string[];
    space?: string[];
    category?: string[];
  };
  range?: {
    price: string;
  };
}

export interface TokensFilters {
  refinementList?: {
    status: string[];
  };
  toggle?: {
    public: boolean;
  };
}

export interface MemberNftsFilters {
  sortBy: string;
  refinementList?: {
    space?: string[];
    collection?: string[];
    owner?: string[];
  };
}

export type Filters =
  | DiscoverSpacesFilters
  | DiscoverAwardsFilters
  | DiscoverCollectionsFilters
  | DiscoverMembersFilters
  | DiscoverProposalsFilters
  | MarketNftsFilters
  | MarketCollectionsFilters
  | TokensFilters
  | MemberNftsFilters;

export const RESET_IGNORE_KEYS = ['sortBy', 'range.price'];

@Injectable({
  providedIn: 'root',
})
export class FilterStorageService {
  public discoverSpacesFiltersOptions = {
    sortItems: [
      { value: 'space_top_members', label: $localize`Top Members` },
      { value: 'space', label: $localize`Recent` },
      { value: 'space_createdOn_desc', label: $localize`Oldest` },
    ],
  };
  public discoverSpacesFiltersVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false,
  );
  public discoverSpacesResetVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false,
  );
  public discoverSpacesFilters$: BehaviorSubject<DiscoverSpacesFilters> =
    new BehaviorSubject<DiscoverSpacesFilters>({
      sortBy: this.discoverSpacesFiltersOptions.sortItems[0].value,
    });

  public discoverAwardsFiltersOptions = {
    sortItems: [
      { value: 'award', label: $localize`Recent` },
      { value: 'award_createdOn_desc', label: $localize`Oldest` },
    ],
  };
  public discoverAwardsFiltersVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false,
  );
  public discoverAwardsResetVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false,
  );
  public discoverAwardsFilters$: BehaviorSubject<DiscoverAwardsFilters> =
    new BehaviorSubject<DiscoverAwardsFilters>({
      sortBy: this.discoverAwardsFiltersOptions.sortItems[0].value,
    });

  public discoverCollectionsFiltersOptions = {
    sortItems: [
      { value: 'collection', label: $localize`Recent` },
      { value: 'collection_createdOn_desc', label: $localize`Oldest` },
    ],
  };
  public discoverCollectionsResetVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false,
  );
  public discoverCollectionsFilters$: BehaviorSubject<DiscoverCollectionsFilters> =
    new BehaviorSubject<DiscoverCollectionsFilters>({
      sortBy: this.discoverCollectionsFiltersOptions.sortItems[0].value,
    });

  public discoverMembersFiltersOptions = {
    sortItems: [
      { value: 'member', label: $localize`Recent` },
      { value: 'member_createdOn_desc', label: $localize`Oldest` },
    ],
  };
  public discoverMembersFiltersVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false,
  );
  public discoverMembersResetVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false,
  );
  public discoverMembersFilters$: BehaviorSubject<DiscoverMembersFilters> =
    new BehaviorSubject<DiscoverMembersFilters>({
      sortBy: this.discoverMembersFiltersOptions.sortItems[0].value,
    });

  public discoverProposalsFiltersOptions = {
    sortItems: [
      { value: 'proposal', label: $localize`Recent` },
      { value: 'proposal_createdOn_desc', label: $localize`Oldest` },
    ],
  };
  public discoverProposalsFiltersVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false,
  );
  public discoverProposalsResetVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false,
  );
  public discoverProposalsFilters$: BehaviorSubject<DiscoverProposalsFilters> =
    new BehaviorSubject<DiscoverProposalsFilters>({
      sortBy: this.discoverProposalsFiltersOptions.sortItems[0].value,
    });

  public marketNftsFiltersOptions = {
    sortItems: [
      { value: 'nft_availableFrom_asc', label: $localize`Available Date` },
      { value: 'nft_createdOn_desc', label: $localize`Recently created` },
      { value: 'nft_price_asc', label: $localize`Price: low to high` },
      { value: 'nft_price_desc', label: $localize`Price: high to low` },
      { value: 'nft_createdOn_asc', label: $localize`Oldest` },
    ],
  };
  public marketNftsFiltersVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);
  public marketNftsResetVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public marketNftsFilters$: BehaviorSubject<MarketNftsFilters> =
    new BehaviorSubject<MarketNftsFilters>({
      sortBy: this.marketNftsFiltersOptions.sortItems[0].value,
    });

  public marketCollectionsFiltersOptions = {
    sortItems: [
      { value: 'collection_vote_desc', label: $localize`Public Vote` },
      { value: 'collection_ranking_desc', label: $localize`Community Rank` },
      { value: 'collection_availableFrom_desc', label: $localize`SOON on Sale` },
      { value: 'collection_createdOn_asc', label: $localize`Oldest` },
      { value: 'collection_minted_on_desc', label: $localize`Recently Minted` },
      { value: 'collection_createdOn_desc', label: $localize`Recently Created` },
    ],
  };
  public marketCollectionsFiltersVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    true,
  );
  public marketCollectionsResetVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false,
  );
  public marketCollectionsFilters$: BehaviorSubject<MarketCollectionsFilters> =
    new BehaviorSubject<MarketCollectionsFilters>({
      sortBy: this.marketCollectionsFiltersOptions.sortItems[0].value,
    });

  public tokensAllTokensFilters$: BehaviorSubject<TokensFilters> =
    new BehaviorSubject<TokensFilters>({
      refinementList: {
        status: [
          TokenStatus.BASE,
          TokenStatus.AVAILABLE,
          TokenStatus.PRE_MINTED,
          TokenStatus.MINTED,
        ],
      },
      toggle: { public: true },
    });

  public tokensTradingPairsFilters$: BehaviorSubject<TokensFilters> =
    new BehaviorSubject<TokensFilters>({
      refinementList: { status: [TokenStatus.BASE, TokenStatus.PRE_MINTED, TokenStatus.MINTED] },
      toggle: { public: true },
    });

  public tokensLaunchpadFilters$: BehaviorSubject<TokensFilters> =
    new BehaviorSubject<TokensFilters>({
      refinementList: { status: [TokenStatus.AVAILABLE] },
      toggle: { public: true },
    });

  public memberNftsFitlers$: BehaviorSubject<MemberNftsFilters> =
    new BehaviorSubject<MemberNftsFilters>({ sortBy: 'nft' });

  constructor() {
    this.discoverSpacesFilters$
      .pipe(map((filters) => this.filterToResetVisibility(filters)))
      .subscribe(this.discoverSpacesResetVisible$);

    this.discoverAwardsFilters$
      .pipe(map((filters) => this.filterToResetVisibility(filters)))
      .subscribe(this.discoverAwardsResetVisible$);

    this.discoverCollectionsFilters$
      .pipe(map((filters) => this.filterToResetVisibility(filters)))
      .subscribe(this.discoverCollectionsResetVisible$);

    this.discoverMembersFilters$
      .pipe(map((filters) => this.filterToResetVisibility(filters)))
      .subscribe(this.discoverMembersResetVisible$);

    this.discoverProposalsFilters$
      .pipe(map((filters) => this.filterToResetVisibility(filters)))
      .subscribe(this.discoverProposalsResetVisible$);

    this.marketNftsFilters$
      .pipe(map((filters) => this.filterToResetVisibility(filters)))
      .subscribe(this.marketNftsResetVisible$);

    this.marketCollectionsFilters$
      .pipe(map((filters) => this.filterToResetVisibility(filters)))
      .subscribe(this.marketCollectionsResetVisible$);
  }

  public filterToResetVisibility(filters: Filters): boolean {
    const obj = flattenObj(filters as unknown as { [key: string]: unknown });
    return (
      Object.keys(obj).filter(
        (key) =>
          !!obj[key] &&
          (!Array.isArray(obj[key]) || (obj[key] as unknown[]).length > 0) &&
          !RESET_IGNORE_KEYS.includes(key),
      ).length > 0
    );
  }
}
