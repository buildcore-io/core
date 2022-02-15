import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Observable } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, WenRequest } from '../../../functions/interfaces/models/base';
import { Nft } from './../../../functions/interfaces/models/nft';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class NftApi extends BaseApi<Nft> {
  public collection = COL.NFT;
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }

  public create(req: WenRequest): Observable<Nft|undefined> {
    return this.request(WEN_FUNC.cNft, req);
  }

  public highToLowInCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('collection', '==', collection).where('hidden', '==', false);
    });
  }

  public lowToHigh(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false);
    });
  }

  public highToLow(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false);
    });
  }

  public lowToHighInCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('collection', '==', collection).where('hidden', '==', false);
    });
  }

  public recentlyChangedCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'updatedOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('collection', '==', collection).where('hidden', '==', false);
    });
  }

  public topMember(member: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'updatedOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('owner', '==', member);
    });
  }
}
