import { Injectable, OnDestroy } from '@angular/core';
import { CollectionApi } from '@api/collection.api';
import { Collection, Space } from "functions/interfaces/models";
import { BehaviorSubject, filter, map, Observable, of, Subscription } from 'rxjs';
import { FULL_LIST } from './../../../@api/base.api';
import { SpaceApi } from './../../../@api/space.api';

export type CacheObject<T> = {
  [key: string]: BehaviorSubject<T | undefined>;
};

export const MAX_MULTIPLE_ITEMS = 10;
export const CACHE_FETCH_DEBOUNCE_SPAN = 250;

@Injectable({
  providedIn: 'root'
})
export class CacheService implements OnDestroy {
  public spaces: CacheObject<Space> = {};
  public allSpacesLoaded$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public allSpacesLoading$ = new BehaviorSubject<boolean>(false);
  public spacesToLoad: string[] = [];
  public fetchSpacesTimeout?: number;
  public collections: CacheObject<Collection> = {};
  public allCollectionsLoaded$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public allCollectionsLoading$ = new BehaviorSubject<boolean>(false);
  public collectionsToLoad: string[] = [];
  public fetchCollectionsTimeout?: number;
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
    this.spaceSubscriptions$.push(this.spaceApi.alphabetical(undefined, undefined, FULL_LIST)?.subscribe(spaces => {
      spaces.forEach(s => {
        const subject = new BehaviorSubject<Space | undefined>(s);
        this.spaces[s.uid] = subject;
      });
      this.allSpacesLoaded$.next(true);
    }));
  }

  public getSpace(id?: string): Observable<Space | undefined> {
    if (!id) {
      return of();
    }

    if (this.spaces[id]) {
      return this.spaces[id];
    }

    this.spaces[id] = new BehaviorSubject<Space | undefined>(undefined);

    this.spacesToLoad.push(id);

    if (this.fetchSpacesTimeout) {
      clearTimeout(this.fetchSpacesTimeout);
      this.fetchSpacesTimeout = undefined;
    }

    this.fetchSpacesTimeout = window.setTimeout(() => {
      this.fetchSpacesTimeout = undefined;
      this.fetchSpaces(this.spacesToLoad);
      this.spacesToLoad = [];
    }, CACHE_FETCH_DEBOUNCE_SPAN);

    if (this.spacesToLoad.length === MAX_MULTIPLE_ITEMS) {
      this.fetchSpaces(this.spacesToLoad);
      this.spacesToLoad = [];
    }

    return this.spaces[id];
  }

  public fetchSpaces(ids: string[]): void {
    if (ids.length === 1) {
      this.spaceSubscriptions$.push(this.spaceApi.listen(ids[0]).subscribe(this.spaces[ids[0]]));
    } else {
      this.spaceSubscriptions$.push(this.spaceApi.listenMultiple(ids)
        .subscribe((s: Space[]) => {
          s.map((c) => this.spaces[c.uid].next(c));
        }));
    }
  }

  public fetchAllCollections(): void {
    if (this.allCollectionsLoaded$.value || this.allCollectionsLoading$.value) return;
    
    this.allCollectionsLoading$.next(true);
    this.collectionSubscriptions$.push(this.collectionApi.alphabetical(undefined, undefined, FULL_LIST).subscribe(collections => {
      collections.forEach(c => {
        const subject = new BehaviorSubject<Collection | undefined>(c);
        this.collections[c.uid] = subject;
      });
      this.allCollectionsLoaded$.next(true);
    }));
  }

  public getCollection(id: string): Observable<Collection | undefined> {
    if (!id) {
      return of();
    }

    if (this.collections[id]) {
      return this.collections[id];
    }

    this.collections[id] = new BehaviorSubject<Collection | undefined>(undefined);

    this.collectionsToLoad.push(id);

    if (this.fetchCollectionsTimeout) {
      clearTimeout(this.fetchCollectionsTimeout);
      this.fetchCollectionsTimeout = undefined;
    }

    this.fetchCollectionsTimeout = window.setTimeout(() => {
      this.fetchCollectionsTimeout = undefined;
      this.fetchCollections(this.collectionsToLoad);
      this.collectionsToLoad = [];
    }, CACHE_FETCH_DEBOUNCE_SPAN);

    if (this.collectionsToLoad.length === MAX_MULTIPLE_ITEMS) {
      this.fetchCollections(this.collectionsToLoad);
      this.collectionsToLoad = [];
    }

    return this.collections[id];
  }

  public fetchCollections(ids: string[]): void {
    if (ids.length === 1) {
      this.collectionSubscriptions$.push(this.collectionApi.listen(ids[0]).subscribe(this.collections[ids[0]]));
    } else {
      this.collectionSubscriptions$.push(this.collectionApi.listenMultiple(ids)
        .subscribe((s: Collection[]) => {
          s.map((c) => this.collections[c.uid].next(c));
        }));
    }
  }

  public cacheObjectToArray<T>(loadSubject: BehaviorSubject<boolean>, obj: CacheObject<T>): Observable<T[]> {
    return loadSubject.pipe(
      filter(r => r),
      map(() => Object.values(obj).map(r => r.value as T).filter(r => !!r))
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
