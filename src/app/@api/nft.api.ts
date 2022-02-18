import { Injectable } from '@angular/core';
import { AngularFirestore, DocumentSnapshot } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Member, Transaction, TransactionBillPayment, TransactionCredit, TransactionOrder, TransactionPayment, TransactionType } from 'functions/interfaces/models';
import { firstValueFrom, Observable, switchMap } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, WenRequest } from '../../../functions/interfaces/models/base';
import { Nft } from './../../../functions/interfaces/models/nft';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

export interface SuccesfullOrdersWithFullHistory {
  newMember: Member;
  order: TransactionOrder;
  billPayments: TransactionBillPayment[];
  credits: TransactionCredit[];
  payments: TransactionPayment[]
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
          billPayments: [],
          credits: [],
          payments: []
        };
        for (const link of o.order.linkedTransactions) {
          const tran: DocumentSnapshot<Transaction> = <any>await firstValueFrom(this.afs.collection(COL.TRANSACTION).doc(link).get());
          if (tran.data()!.type === TransactionType.BILL_PAYMENT) {
            o.billPayments.push(tran.data()!);
          } else if (tran.data()!.type === TransactionType.CREDIT) {
            o.credits.push(tran.data()!);
          } else if (tran.data()!.type === TransactionType.PAYMENT) {
            o.payments.push(tran.data()!);
          }
          console.log(tran.data()!.uid, tran.data()!.type, tran.data()!.payload.amount, tran.data()!.payload.chainReference);
        }

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
}
