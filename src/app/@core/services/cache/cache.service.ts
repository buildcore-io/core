import { Injectable, OnDestroy } from '@angular/core';
import { CollectionApi } from '@api/collection.api';
import { Collection, Space } from "functions/interfaces/models";
import { BehaviorSubject, filter, map, Observable, of, Subscription } from 'rxjs';
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
  public spaces: CacheObject<Space> = {};
  public allSpacesLoaded$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public allSpacesLoading$ = new BehaviorSubject<boolean>(false);
  public collections: CacheObject<Collection> = {};
  public allCollectionsLoaded$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public allCollectionsLoading$ = new BehaviorSubject<boolean>(false);
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

  public fetchAllSpaces(): void {
    if (this.allSpacesLoaded$.value || this.allSpacesLoading$.value) return;
    
    this.allSpacesLoading$.next(true);
    this.spaceSubscriptions$.push(this.spaceApi.alphabetical(undefined, undefined, FULL_LIST).subscribe(spaces => {
      spaces.forEach(s => {
        const subject = new BehaviorSubject<Space | undefined>(s);
        this.spaces[s.uid]= {
          fetchDate: new Date(),
          value: subject
        }
      });
      this.allSpacesLoaded$.next(true);
    }));
  }

  public getSpace(id?: string): Observable<Space | undefined> {
    if (!id) {
      return of();
    }
    if (this.spaces[id]) {
      return this.spaces[id].value;
    }
    const subject = new BehaviorSubject<Space | undefined>(undefined);
    this.spaceSubscriptions$.push(this.spaceApi.listen(id).subscribe(subject));
    // this.spaceSubscriptions$.push(this.spaceApi.listenMultiple([id]).subscribe(s => subject.next(s[0])));
    this.spaces[id] = {
      fetchDate: new Date(),
      value: subject
    }
    return subject;
  }

  public fetchAllCollections(): void {
    if (this.allCollectionsLoaded$.value || this.allCollectionsLoading$.value) return;
    
    this.allCollectionsLoading$.next(true);
    this.collectionSubscriptions$.push(this.collectionApi.alphabetical(undefined, undefined, FULL_LIST).subscribe(collections => {
      collections.forEach(c => {
        const subject = new BehaviorSubject<Collection | undefined>(c);
        this.collections[c.uid]= {
          fetchDate: new Date(),
          value: subject
        }
      });
      this.allCollectionsLoaded$.next(true);
    }));
  }

  public getCollection(id: string): Observable<Collection | undefined> {
    if (!id) {
      return of();
    }
    if (this.collections[id]) {
      return this.collections[id].value;
    }
    const subject = new BehaviorSubject<Collection | undefined>(undefined);
    this.collectionSubscriptions$.push(this.collectionApi.listen(id).subscribe(subject));
    this.collections[id] = {
      fetchDate: new Date(),
      value: subject
    }
    return subject;
  }

  public cacheObjectToArray<T>(loadSubject: BehaviorSubject<boolean>, obj: CacheObject<T>): Observable<T[]> {
    return loadSubject.pipe(
      filter(r => r),
      map(() => Object.values(obj).map(r => r.value?.value as T).filter(r => !!r))
    );
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
