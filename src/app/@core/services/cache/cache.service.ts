import { Injectable } from '@angular/core';
import { CollectionApi } from '@api/collection.api';
import { Collection, Space } from "functions/interfaces/models";
import { BehaviorSubject, Subscription } from 'rxjs';
import { FULL_LIST } from './../../../@api/base.api';
import { SpaceApi } from './../../../@api/space.api';

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  public allSpaces$ = new BehaviorSubject<Space[]>([]);
  // TODO This should be ideally removed eventually.
  public allCollections$ = new BehaviorSubject<Collection[]>([]);
  // We use this instead of optional params to open check after clicking buy now in the NFT card.
  public openCheckout = false;
  private subscriptions$: Subscription[] = [];
  constructor(
    private spaceApi: SpaceApi,
    private collectionApi: CollectionApi
  ) {
    // none.
  }

  public initCache(): void {
    this.subscriptions$.push(this.spaceApi.alphabetical(undefined, undefined, FULL_LIST).subscribe(this.allSpaces$));
    this.subscriptions$.push(this.collectionApi.alphabetical(undefined, undefined, FULL_LIST).subscribe(this.allCollections$));
  }

  public cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
