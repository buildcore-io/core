import { Injectable } from '@angular/core';
import { AngularFirestore, DocumentSnapshot } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Member, Transaction, TransactionOrder, TransactionOrderType, TransactionPayment, TransactionType } from '@functions/interfaces/models';
import { firstValueFrom, Observable, switchMap } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, WenRequest } from '../../../functions/interfaces/models/base';
import { Nft, NftAvailable } from './../../../functions/interfaces/models/nft';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

export interface SuccesfullOrdersWithFullHistory {
  newMember: Member;
  order: TransactionOrder;
  transactions: Transaction[];
}

export interface OffersHistory {
  member: Member;
  transaction: TransactionPayment;
}

@Injectable({
  providedIn: 'root',
})
export class NftApi extends BaseApi<Nft> {
  public collection = COL.NFT;
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }

  public create(req: WenRequest): Observable<Nft | undefined> {
    return this.request(WEN_FUNC.cNft, req);
  }

  public batchCreate(req: WenRequest): Observable<string[] | undefined> {
    return this.request(WEN_FUNC.cBatchNft, req);
  }

  public setForSaleNft(req: WenRequest): Observable<Nft | undefined> {
    return this.request(WEN_FUNC.setForSaleNft, req);
  }

  public successfullOrders(nftId: string): Observable<SuccesfullOrdersWithFullHistory[]> {
    return this.afs.collection<SuccesfullOrdersWithFullHistory>(
      COL.TRANSACTION,
      // We limit this to last record only. CreatedOn is always defined part of every record.
      (ref) => {
        return ref.where('payload.nft', '==', nftId).where('type', '==', TransactionType.BILL_PAYMENT).where('payload.royalty', '==', false)
      }
    ).valueChanges().pipe(switchMap(async(obj: any[]) => {
      let out: SuccesfullOrdersWithFullHistory[] = [];
      for (const b of obj) {
        const sourceTransaction = b.payload.sourceTransaction[b.payload.sourceTransaction.length - 1]
        const order: DocumentSnapshot<TransactionOrder> = <any> await firstValueFrom(this.afs.collection(COL.TRANSACTION).doc(sourceTransaction).get());
        const member: DocumentSnapshot<Member> = <any> await firstValueFrom(this.afs.collection(COL.MEMBER).doc(b.member).get());
        const o: SuccesfullOrdersWithFullHistory = {
          newMember: member.data()!,
          order: order.data()!,
          transactions: []
        };
        for (const link of o.order.linkedTransactions) {
          const tran: DocumentSnapshot<Transaction> = <any> await firstValueFrom(this.afs.collection(COL.TRANSACTION).doc(link).get());
          if ((tran.data()?.payload.void !== true && tran.data()?.payload.invalidPayment !== true) || tran.data()?.type === TransactionType.BILL_PAYMENT) {
            o.transactions.push(tran.data()!);

            // Make sure order price is ovewriten with payment price.
            // During bidding this can be different to what it was initially. Date should also be when it was paid.
            if (tran.data()?.type === TransactionType.PAYMENT) {
              o.order.payload.amount = tran.data()?.payload.amount;
              o.order.createdOn = tran.data()?.createdOn;
            }
          }
        }

        // Order transactions by date.
        o.transactions = o.transactions.sort((c, b) => {
          return b.createdOn!.toMillis() - c.createdOn!.toMillis();
        });

        out.push(o);
      }

      // Order from latest.
      out = out.sort((c, b) => {
        return b.order.createdOn!.toMillis() - c.order.createdOn!.toMillis();
      });

      return out;
    }));
  }

  public getOffers(nft: Nft): Observable<OffersHistory[]> {
    return this.afs.collection<OffersHistory>(
      COL.TRANSACTION,
      (ref) => {
        return ref
          .where('payload.nft', '==', nft.uid)
          .where('createdOn', '<', nft.auctionTo?.toDate())
          .where('createdOn', '>', nft.auctionFrom?.toDate())
          .where('type', '==', TransactionType.PAYMENT)
      }
    ).valueChanges().pipe(switchMap(async(obj: any[]) => {
      let out: OffersHistory[] = [];
      for (const b of obj) {
        const member: DocumentSnapshot<Member> = <any> await firstValueFrom(this.afs.collection(COL.MEMBER).doc(b.member).get());
        const o: OffersHistory = {
          member: member.data()!,
          transaction: b
        };

        out.push(o);
      }

      // Order from latest.
      out = out.sort((c, b) => {
        return b.transaction.payload.amount - c.transaction.payload.amount;
      });

      return out;
    }));
  }

  public getMembersBids(member: Member, nft: Nft, currentAuction = false): Observable<Transaction[]> {
    return this.afs.collection<Transaction>(
      COL.TRANSACTION,
      (ref) => {
        ref = <any>ref
          .where('payload.nft', '==', nft.uid)
          .where('member', '==', member.uid);

        if (currentAuction) {
          ref = <any>ref.where('createdOn', '<', nft.auctionTo?.toDate()).where('createdOn', '>', nft.auctionFrom?.toDate());
        }

        return ref.where('type', 'in', [TransactionType.PAYMENT, TransactionType.CREDIT]).orderBy('createdOn', 'desc')
      }
    ).valueChanges().pipe(switchMap(async(obj: any[]) => {
      let out: Transaction[] = [];
      for (const b of obj) {
        // TODO Retrieve in parallel.
        let sourceTransaction = b.payload.sourceTransaction[b.payload.sourceTransaction.length - 1]
        const tran: DocumentSnapshot<any> = <any> await firstValueFrom(this.afs.collection(COL.TRANSACTION).doc(sourceTransaction).get());
        // If payment we have to got to order
        let tran2: DocumentSnapshot<TransactionOrder>|undefined = undefined;
        if (tran.data()?.type === TransactionType.PAYMENT) {
          sourceTransaction = tran.data()?.payload.sourceTransaction[tran.data()?.payload.sourceTransaction.length - 1]
          tran2 = <any> await firstValueFrom(this.afs.collection(COL.TRANSACTION).doc(sourceTransaction).get());
        }

        if (
          tran.data()?.payload.type === TransactionOrderType.NFT_BID ||
          tran2?.data()?.payload.type === TransactionOrderType.NFT_BID
        ) {
          out.push(b);
        }
      }

      // Order from latest.
      out = out.sort((c, b) => {
        return b.payload.createdOn - c.payload.createdOn;
      });

      return out;
    }));
  }

  public topApproved(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('approved', '==', true).where('hidden', '==', false);
    });
  }

  public highToLowInCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('collection', '==', collection).where('hidden', '==', false);
    });
  }

  public lowToHigh(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('approved', '==', true);
    });
  }

  public highToLow(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('approved', '==', true);
    });
  }

  public topAvailable(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('available', '==', NftAvailable.SALE).where('approved', '==', true);
    });
  }

  public topAuction(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('available', '==', NftAvailable.AUCTION).where('approved', '==', true);
    });
  }

  public lowToHighAvailable(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'availablePrice', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('available', '==', NftAvailable.SALE).where('approved', '==', true);
    });
  }

  public lowToHighAuction(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'auctionHighestBid', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('available', '==', NftAvailable.AUCTION).where('approved', '==', true);
    });
  }

  public highToLowAvailable(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'availablePrice', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('available', '==', NftAvailable.SALE).where('approved', '==', true);
    });
  }

  public highToLowAuction(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'auctionHighestBid', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('available', '==', NftAvailable.AUCTION).where('approved', '==', true);
    });
  }

  public topOwned(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('isOwned', '==', true).where('approved', '==', true);
    });
  }

  public lowToHighOwned(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('isOwned', '==', true).where('approved', '==', true);
    });
  }

  public highToLowOwned(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('isOwned', '==', true).where('approved', '==', true);
    });
  }

  public topSpace(space: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('space', '==', space).where('approved', '==', true);
    });
  }

  public lowToHighSpace(space: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('space', '==', space).where('approved', '==', true);
    });
  }

  public highToLowSpace(space: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('space', '==', space).where('approved', '==', true);
    });
  }

  // Collection - this includes unapproved.
  public lastCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'createdOn', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('collection', '==', collection);
    });
  }

  public topCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('collection', '==', collection);
    });
  }

  public topPendingCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('isOwned', '==', false).where('approved', '==', false).where('rejected', '==', false).where('collection', '==', collection);
    });
  }

  public lowToHighPendingCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('isOwned', '==', false).where('approved', '==', false).where('rejected', '==', false).where('collection', '==', collection);
    });
  }

  public lowToHighCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('collection', '==', collection);
    });
  }

  public highToLowPendingCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('isOwned', '==', false).where('approved', '==', false).where('rejected', '==', false).where('collection', '==', collection);
    });
  }

  public highToLowCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('collection', '==', collection);
    });
  }

  public topAvailableCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('available', '==', NftAvailable.SALE).where('collection', '==', collection);
    });
  }

  public lowToHighAvailableCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'availablePrice', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('available', '==', NftAvailable.SALE).where('collection', '==', collection);
    });
  }

  public highToLowAvailableCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'availablePrice', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('available', '==', NftAvailable.SALE).where('collection', '==', collection);
    });
  }

  public topAuctionCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('available', '==', NftAvailable.AUCTION).where('collection', '==', collection);
    });
  }

  public lowToHighAuctionCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'auctionHighestBid', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('available', '==', NftAvailable.AUCTION).where('collection', '==', collection);
    });
  }

  public highToLowAuctionCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'auctionHighestBid', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('available', '==', NftAvailable.AUCTION).where('collection', '==', collection);
    });
  }

  public topOwnedCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('isOwned', '==', true).where('collection', '==', collection);
    });
  }

  public lowToHighOwnedCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('isOwned', '==', true).where('collection', '==', collection);
    });
  }

  public highToLowOwnedCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'price', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('isOwned', '==', true).where('collection', '==', collection);
    });
  }
  // COLLECTION END

  public positionInCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'position', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('collection', '==', collection).where('hidden', '==', false);
    });
  }

  public recentlyChangedCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'updatedOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('collection', '==', collection).where('hidden', '==', false);
    });
  }

  public topMember(member: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'updatedOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('owner', '==', member);
    });
  }

  public topMemberByCollection(collection: string, member: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query(this.collection, 'updatedOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('hidden', '==', false).where('owner', '==', member).where('collection', '==', collection);
    });
  }
}
