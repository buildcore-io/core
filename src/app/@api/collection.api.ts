import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Collection, CollectionAccess } from "functions/interfaces/models";
import { Observable } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, WenRequest } from '../../../functions/interfaces/models/base';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

export enum CollectionFilter {
    ALL = 'all',
    PENDING = 'pending',
    REJECTED = 'rejected',
    AVAILABLE = 'available'
}

@Injectable({
  providedIn: 'root',
})
export class CollectionApi extends BaseApi<Collection> {
  public collection = COL.COLLECTION;
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }

  public lowToHigh(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Collection[]> {
    return this._query(this.collection, 'price', 'asc', lastValue, search, def);
  }

  public highToLow(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Collection[]> {
    return this._query(this.collection, 'price', 'desc', lastValue, search, def);
  }

  public lowToHighAccess(access: CollectionAccess, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Collection[]> {
    return this._query(this.collection, 'price', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('access', '==', access);
    });
  }

  public highToLowAccess(access: CollectionAccess, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Collection[]> {
    return this._query(this.collection, 'price', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('access', '==', access);
    });
  }

  public lowToHighSpace(space: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Collection[]> {
    return this._query(this.collection, 'price', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('space', '==', space);
    });
  }

  public highToLowSpace(space: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Collection[]> {
    return this._query(this.collection, 'price', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('space', '==', space);
    });
  }

  public lowToHighCategory(category: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Collection[]> {
    return this._query(this.collection, 'price', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('category', '==', category);
    });
  }

  public highToLowCategory(category: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Collection[]> {
    return this._query(this.collection, 'price', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('category', '==', category);
    });
  }

  public lastWithinSpace(space: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Collection[]> {
    return this._query(this.collection, 'createdOn', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('space', '==', space);
    });
  }

  public topWithinSpace(space: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Collection[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('space', '==', space);
    });
  }

  public allPendingSpace(space: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Collection[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('space', '==', space).where('approved', '==', false).where('rejected', '==', false);
    });
  }

  public allSpace(space: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Collection[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('space', '==', space);
    });
  }

  public allAvailableSpace(space: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Collection[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('space', '==', space).where('approved', '==', true);
    });
  }

  public allRejectedSpace(space: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Collection[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('space', '==', space).where('rejected', '==', true);
    });
  }

  public create(req: WenRequest): Observable<Collection|undefined> {
    return this.request(WEN_FUNC.cCollection, req);
  }

  public update(req: WenRequest): Observable<Collection|undefined> {
    return this.request(WEN_FUNC.uCollection, req);
  }

  public approve(req: WenRequest): Observable<Collection|undefined> {
    return this.request(WEN_FUNC.approveCollection, req);
  }

  public reject(req: WenRequest): Observable<Collection|undefined> {
    return this.request(WEN_FUNC.rejectCollection, req);
  }
}
