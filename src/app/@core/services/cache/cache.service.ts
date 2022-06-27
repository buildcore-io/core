import { Injectable, OnDestroy } from '@angular/core';
import { CollectionApi } from '@api/collection.api';
import { Collection, Space } from "functions/interfaces/models";
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { FULL_LIST } from './../../../@api/base.api';
import { SpaceApi } from './../../../@api/space.api';

export type CacheObject<T> = {
  [key: string]: {
    value: BehaviorSubject<T | undefined>;
    fetchDate: Date;
  };
};

@Injectable({
  providedIn: 'root'
})
export class CacheService implements OnDestroy {
  public allSpaces$ = new BehaviorSubject<Space[]>([]);
  public spaces: CacheObject<Space> = {};
  public allSpacesLoaded$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  // TODO This should be ideally removed eventually.
  public allCollections$ = new BehaviorSubject<Collection[]>([]);
  public collections: CacheObject<Collection> = {};
  // We use this instead of optional params to open check after clicking buy now in the NFT card.
  public openCheckout = false;
  private spaceSubscriptions$: Subscription[] = [];
  private collectionSubscriptions$: Subscription[] = [];

  constructor(
    private spaceApi: SpaceApi,
    private collectionApi: CollectionApi
  ) {
    // none.
  }

  public initCache(): void {
    this.spaceSubscriptions$.push(this.spaceApi.alphabetical(undefined, undefined, FULL_LIST).subscribe(this.allSpaces$));
    this.collectionSubscriptions$.push(this.collectionApi.alphabetical(undefined, undefined, FULL_LIST).subscribe(this.allCollections$));
  }

  // public fetchAllSpaces(): void {
  //   this.spaceSubscriptions$.push(this.spaceApi.alphabetical(undefined, undefined, FULL_LIST).subscribe(spaces => {
  //     spaces.forEach(s => {
  //       const subject = new BehaviorSubject<Space | undefined>(s);
  //       this.spaces[s.uid]= {
  //         fetchDate: new Date(),
  //         value: subject
  //       }
  //     });
  //     this.allSpacesLoaded$.next(true);
  //   }));
  // }

  public getSpace(id: string): Observable<Space | undefined> {
    if (this.spaces[id]) {
      return this.spaces[id].value;
    } else {
      const subject = new BehaviorSubject<Space | undefined>(undefined);
      this.spaceSubscriptions$.push(this.spaceApi.listen(id).subscribe(subject));
      // this.spaceSubscriptions$.push(this.spaceApi.listenMultiple([id]).subscribe(s => subject.next(s[0])));
      this.spaces[id] = {
        fetchDate: new Date(),
        value: subject
      }
      return subject;
    }
  }

  // public fetchAllCollections(): void {

  // }

  public getCollection(id: string): Observable<Collection | undefined> {
    if (this.collections[id]) {
      return this.collections[id].value;
    } else {
      const subject = new BehaviorSubject<Collection | undefined>(undefined);
      this.collectionSubscriptions$.push(this.collectionApi.listen(id).subscribe(subject));
      this.collections[id] = {
        fetchDate: new Date(),
        value: subject
      }
      return subject;
    }
  }

  public cancelSubscriptions(): void {
    this.spaceSubscriptions$.forEach((s) => {
      s.unsubscribe();
    });
    this.collectionSubscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
