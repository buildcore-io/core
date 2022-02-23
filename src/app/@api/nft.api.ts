import { Injectable } from '@angular/core';
import { AngularFirestore, DocumentSnapshot } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Member, Transaction, TransactionOrder, TransactionType } from 'functions/interfaces/models';
import { firstValueFrom, Observable, switchMap } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, WenRequest } from '../../../functions/interfaces/models/base';
import { Nft } from './../../../functions/interfaces/models/nft';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

export interface SuccesfullOrdersWithFullHistory {
  newMember: Member;
  order: TransactionOrder;
  transactions: Transaction[];
}

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

  public batchCreate(req: WenRequest): Observable<string[]|undefined> {
    return this.request(WEN_FUNC.cBatchNft, req);
  }

  public successfullOrders(nftId: string): Observable<SuccesfullOrdersWithFullHistory[]> {
    return this.afs.collection<SuccesfullOrdersWithFullHistory>(
      COL.TRANSACTION,
      // We limit this to last record only. CreatedOn is always defined part of every record.
      (ref) => {
        return ref.where('payload.nft', '==', nftId).where('type', '==', TransactionType.BILL_PAYMENT).where('payload.royalty', '==', false)
      }
    ).valueChanges().pipe(switchMap(async (obj: any[]) => {
      const out: SuccesfullOrdersWithFullHistory[] = [];
      for (const b of obj) {
        const order: DocumentSnapshot<TransactionOrder> = <any>await firstValueFrom(this.afs.collection(COL.TRANSACTION).doc(b.payload.sourceTransaction).get());
        const member: DocumentSnapshot<Member> = <any>await firstValueFrom(this.afs.collection(COL.MEMBER).doc(b.member).get());
        const o: SuccesfullOrdersWithFullHistory = {
          newMember: member.data()!,
          order: order.data()!,
          transactions: []
        };
        for (const link of o.order.linkedTransactions) {
          const tran: DocumentSnapshot<Transaction> = <any>await firstValueFrom(this.afs.collection(COL.TRANSACTION).doc(link).get());
          o.transactions.push(tran.data()!);
        }

        // Order transactions by date.
        o.transactions = o.transactions.sort((c) => {
          return c.createdOn!.toMillis() * -1;
        });

        out.push(o);
      }

      return out;
    }));
  }

  public highToLowInCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('collection', '==', collection).where('hidden', '==', false);
    });
  }

  public lowToHigh(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('approved', '==', true);
    });
  }

  public highToLow(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('approved', '==', true);
    });
  }

  public topAvailable(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, ['availableFrom', 'createdOn'], 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('availableFrom', '<=', new Date()).where('approved', '==', true);
    });
  }

  public lowToHighAvailable(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, ['availableFrom', 'price'], 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('availableFrom', '<=', new Date()).where('approved', '==', true);
    });
  }

  public highToLowAvailable(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, ['availableFrom', 'price'], 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('availableFrom', '<=', new Date()).where('approved', '==', true);
    });
  }

  public topOwned(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, ['owner', 'createdOn'], 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('owner', '!=', null).where('approved', '==', true);
    });
  }

  public lowToHighOwned(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, ['owner', 'price'], 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('owner', '!=', null).where('approved', '==', true);
    });
  }

  public highToLowOwned(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, ['owner', 'price'], 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('owner', '!=', null).where('approved', '==', true);
    });
  }

  public topSpace(space: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('space', '==', space).where('approved', '==', true);
    });
  }

  public lowToHighSpace(space: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('space', '==', space).where('approved', '==', true);
    });
  }

  public highToLowSpace(space: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('space', '==', space).where('approved', '==', true);
    });
  }

  // Collection - this includes unapproved.
  public lastCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'createdOn', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('collection', '==', collection);
    });
  }

  public topCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('collection', '==', collection);
    });
  }

  public lowToHighCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('collection', '==', collection);
    });
  }

  public highToLowCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('collection', '==', collection);
    });
  }

  public topAvailableCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, ['availableFrom', 'createdOn'], 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('availableFrom', '<=', new Date()).where('collection', '==', collection);
    });
  }

  public lowToHighAvailableCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, ['availableFrom', 'price'], 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('availableFrom', '<=', new Date()).where('collection', '==', collection);
    });
  }

  public highToLowAvailableCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, ['availableFrom', 'price'], 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('availableFrom', '<=', new Date()).where('collection', '==', collection);
    });
  }

  public topOwnedCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, ['owner', 'createdOn'], 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('owner', '!=', null).where('collection', '==', collection);
    });
  }

  public lowToHighOwnedCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, ['owner', 'price'], 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('owner', '!=', null).where('collection', '==', collection);
    });
  }

  public highToLowOwnedCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, ['owner', 'price'], 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('owner', '!=', null).where('collection', '==', collection);
    });
  }
  // COLLECTION END

  public positionInCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'position', 'asc', lastValue, search, def, (ref: any) => {
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

  public topMemberByCollection(collection: string, member: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'updatedOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('owner', '==', member).where('collection', '==', collection);
    });
  }
}
