import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

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

@Injectable({
  providedIn: 'root'
})
export class FilterStorageService {

  public discoverSpacesFiltersOptions = {
    sortItems: [
      { value: 'space', label: $localize`Recent` },
      { value: 'space_createdOn_desc', label: $localize`Oldest` },
    ]
  };
  public discoverSpacesFiltersVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public discoverSpacesFilters$: BehaviorSubject<DiscoverSpacesFilters> =
    new BehaviorSubject<DiscoverSpacesFilters>({ sortBy: this.discoverSpacesFiltersOptions.sortItems[0].value });

  public discoverAwardsFiltersOptions = {
    sortItems: [
      { value: 'award', label: $localize`Recent` },
      { value: 'award_createdOn_desc', label: $localize`Oldest` },
    ]
  };
  public discoverAwardsFiltersVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public discoverAwardsFilters$: BehaviorSubject<DiscoverAwardsFilters> =
    new BehaviorSubject<DiscoverAwardsFilters>({ sortBy: this.discoverAwardsFiltersOptions.sortItems[0].value });
  
  public discoverCollectionsFiltersOptions = {
    sortItems: [
      { value: 'collection', label: $localize`Recent` },
      { value: 'collection_createdOn_desc', label: $localize`Oldest` },
    ]
  };
  public discoverCollectionsFiltersVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public discoverCollectionsFilters$: BehaviorSubject<DiscoverCollectionsFilters> =
    new BehaviorSubject<DiscoverCollectionsFilters>({ sortBy: this.discoverCollectionsFiltersOptions.sortItems[0].value });
  
  public discoverMembersFiltersOptions = {
    sortItems: [
      { value: 'member', label: $localize`Recent` },
      { value: 'member_createdOn_desc', label: $localize`Oldest` },
    ]
  };
  public discoverMembersFiltersVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public discoverMembersFilters$: BehaviorSubject<DiscoverMembersFilters> =
    new BehaviorSubject<DiscoverMembersFilters>({ sortBy: this.discoverMembersFiltersOptions.sortItems[0].value });

  
  public discoverProposalsFiltersOptions = {
    sortItems: [
      { value: 'proposal', label: $localize`Recent` },
      { value: 'proposal_createdOn_desc', label: $localize`Oldest` },
    ]
  };
  public discoverProposalsFiltersVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public discoverProposalsFilters$: BehaviorSubject<DiscoverProposalsFilters> =
    new BehaviorSubject<DiscoverProposalsFilters>({ sortBy: this.discoverProposalsFiltersOptions.sortItems[0].value });
    
  public marketNftsFiltersOptions = {
    sortItems: [
      { value: 'nft', label: $localize`Recent` },
      { value: 'nft_price_asc', label: $localize`Low to High` },
      { value: 'nft_price_desc', label: $localize`High to Low` },
    ]
  };
  public marketNftsFiltersVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public marketNftsFilters$: BehaviorSubject<MarketNftsFilters> =
    new BehaviorSubject<MarketNftsFilters>({ sortBy: this.marketNftsFiltersOptions.sortItems[0].value });
  
  public marketCollectionsFiltersOptions = {
    sortItems: [
      { value: 'collection', label: $localize`Recent` },
      { value: 'collection_price_asc', label: $localize`Low to High` },
      { value: 'collection_price_desc', label: $localize`High to Low`},
    ]
  };
  public marketCollectionsFiltersVisible$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public marketCollectionsFilters$: BehaviorSubject<MarketCollectionsFilters> =
    new BehaviorSubject<MarketCollectionsFilters>({ sortBy: this.marketCollectionsFiltersOptions.sortItems[0].value });
}
