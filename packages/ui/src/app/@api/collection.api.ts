import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { doc, docData, Firestore, where } from '@angular/fire/firestore';
import {
  COL,
  Collection,
  CollectionStats,
  SUB_COL,
  Transaction,
  WEN_FUNC,
  WenRequest,
} from '@soonaverse/interfaces';
import { Observable, of } from 'rxjs';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

export enum CollectionFilter {
  ALL = 'all',
  PENDING = 'pending',
  REJECTED = 'rejected',
  AVAILABLE = 'available',
}

@Injectable({
  providedIn: 'root',
})
export class CollectionApi extends BaseApi<Collection> {
  public collection = COL.COLLECTION;

  constructor(protected firestore: Firestore, protected httpClient: HttpClient) {
    super(firestore, httpClient);
  }

  public mintCollection(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.mintCollection, req);
  }

  public vote(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.voteController, req);
  }

  public rank(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.rankController, req);
  }

  public stats(collectionId: string): Observable<CollectionStats | undefined> {
    if (!collectionId) {
      return of(undefined);
    }

    return docData(
      doc(
        this.firestore,
        this.collection,
        collectionId.toLowerCase(),
        SUB_COL.STATS,
        collectionId.toLowerCase(),
      ),
    ) as Observable<CollectionStats | undefined>;
  }

  public allPendingSpace(
    space: string,
    lastValue?: number,
    def = DEFAULT_LIST_SIZE,
  ): Observable<Collection[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
      constraints: [
        where('space', '==', space),
        where('approved', '==', false),
        where('rejected', '==', false),
      ],
    });
  }

  public allAvailableSpace(
    space: string,
    lastValue?: number,
    def = DEFAULT_LIST_SIZE,
  ): Observable<Collection[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
      constraints: [where('space', '==', space), where('approved', '==', true)],
    });
  }

  public allRejectedSpace(
    space: string,
    lastValue?: number,
    def = DEFAULT_LIST_SIZE,
  ): Observable<Collection[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
      constraints: [where('space', '==', space), where('rejected', '==', true)],
    });
  }

  public create(req: WenRequest): Observable<Collection | undefined> {
    return this.request(WEN_FUNC.cCollection, req);
  }

  public update(req: WenRequest): Observable<Collection | undefined> {
    return this.request(WEN_FUNC.uCollection, req);
  }

  public approve(req: WenRequest): Observable<Collection | undefined> {
    return this.request(WEN_FUNC.approveCollection, req);
  }

  public reject(req: WenRequest): Observable<Collection | undefined> {
    return this.request(WEN_FUNC.rejectCollection, req);
  }
}
