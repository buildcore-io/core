import { Injectable } from '@angular/core';
import { collection, collectionData, doc, docData, Firestore, orderBy as ordBy, query, QueryConstraint, where } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
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
  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
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

  public withdrawNft(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.withdrawNft, req);
  }

  public depositNft(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.depositNft, req);
  }

  public successfullOrders(nftId: string): Observable<SuccesfullOrdersWithFullHistory[]> {
    return collectionData(
      query(
        collection(this.firestore, COL.TRANSACTION),
        where('payload.nft', '==', nftId),
        where('type', '==', TransactionType.BILL_PAYMENT),
        where('payload.royalty', '==', false)
      )
    ).pipe(switchMap(async(obj: any[]) => {
      let out: SuccesfullOrdersWithFullHistory[] = [];
      for (const b of obj) {
        const sourceTransaction = Array.isArray(b.payload.sourceTransaction) ? b.payload.sourceTransaction[b.payload.sourceTransaction.length - 1] : b.payload.sourceTransaction;
        const order: TransactionOrder = <any> await firstValueFrom(docData(doc(this.firestore, COL.TRANSACTION, sourceTransaction)));
        const member: Member = <any> await firstValueFrom(docData(doc(this.firestore, COL.MEMBER, b.member)));
        const o: SuccesfullOrdersWithFullHistory = {
          newMember: member!,
          order: order!,
          transactions: []
        };
        for (const link of o.order.linkedTransactions) {
          const tran: Transaction = <any> await firstValueFrom(docData(doc(this.firestore, COL.TRANSACTION, link)));
          if ((tran?.payload.void !== true && tran?.payload.invalidPayment !== true) || tran?.type === TransactionType.BILL_PAYMENT) {
            o.transactions.push(tran!);

            // Make sure order price is ovewriten with payment price.
            // During bidding this can be different to what it was initially. Date should also be when it was paid.
            if (tran?.type === TransactionType.PAYMENT) {
              o.order.payload.amount = tran?.payload.amount;
              o.order.createdOn = tran?.createdOn;
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
    return collectionData(
      query(
        collection(this.firestore, COL.TRANSACTION),
        where('payload.nft', '==', nft.uid),
        where('createdOn', '<', nft.auctionTo?.toDate()),
        where('createdOn', '>', nft.auctionFrom?.toDate()),
        where('type', '==', TransactionType.PAYMENT)
      )
    ).pipe(switchMap(async(obj: any[]) => {
      let out: OffersHistory[] = [];
      for (const b of obj) {
        const member: Member = <any> await firstValueFrom(docData(doc(this.firestore, COL.MEMBER, b.member)));
        const o: OffersHistory = {
          member: member!,
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
    const constraints: QueryConstraint[] = [];
    constraints.push(where('payload.nft', '==', nft.uid));
    constraints.push(where('member', '==', member.uid));
    if (currentAuction) {
      constraints.push(where('createdOn', '<', nft.auctionTo?.toDate()))
      constraints.push(where('createdOn', '>', nft.auctionFrom?.toDate()));
    }
    constraints.push(where('type', 'in', [TransactionType.PAYMENT, TransactionType.CREDIT]));
    constraints.push(ordBy('createdOn', 'desc'));

    return collectionData(
      query(
        collection(this.firestore, COL.TRANSACTION),
        ...constraints
      )
    ).pipe(switchMap(async(obj: any[]) => {
      let out: Transaction[] = [];
      for (const b of obj) {
        // TODO Retrieve in parallel.
        let sourceTransaction = Array.isArray(b.payload.sourceTransaction) ? b.payload.sourceTransaction[b.payload.sourceTransaction.length - 1] : b.payload.sourceTransaction;
        const tran: Transaction|undefined = <any> await firstValueFrom(docData(doc(this.firestore, COL.TRANSACTION, sourceTransaction)));
        // If payment we have to got to order
        let tran2: TransactionOrder|undefined = undefined;
        if (tran?.type === TransactionType.PAYMENT) {
          sourceTransaction = tran?.payload.sourceTransaction[tran?.payload.sourceTransaction.length - 1]
          tran2 = <any> await firstValueFrom(docData(doc(this.firestore, COL.TRANSACTION, sourceTransaction)));
        }

        if (
          tran?.payload.type === TransactionOrderType.NFT_BID ||
          tran2?.payload.type === TransactionOrderType.NFT_BID
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
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('approved', '==', true),
        where('hidden', '==', false)
      ]
    });
  }

  public highToLowInCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('collection', '==', collection),
        where('hidden', '==', false)
      ]
    });
  }

  public lowToHigh(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'asc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('approved', '==', true)
      ]
    });
  }

  public highToLow(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('approved', '==', true)
      ]
    });
  }

  public topAvailable(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('available', '==', NftAvailable.SALE),
        where('approved', '==', true)
      ]
    });
  }

  public topAuction(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('available', '==', NftAvailable.AUCTION),
        where('approved', '==', true)
      ]
    });
  }

  public lowToHighAvailable(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'availablePrice',
      direction: 'asc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('available', '==', NftAvailable.SALE),
        where('approved', '==', true)
      ]
    });
  }

  public lowToHighAuction(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'auctionHighestBid',
      direction: 'asc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('available', '==', NftAvailable.AUCTION),
        where('approved', '==', true)
      ]
    });
  }

  public highToLowAvailable(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'availablePrice',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('available', '==', NftAvailable.SALE),
        where('approved', '==', true)
      ]
    });
  }

  public highToLowAuction(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'auctionHighestBid',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('available', '==', NftAvailable.AUCTION),
        where('approved', '==', true)
      ]
    });
  }

  public topOwned(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('isOwned', '==', true),
        where('approved', '==', true)
      ]
    });
  }

  public lowToHighOwned(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'asc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('isOwned', '==', true),
        where('approved', '==', true)
      ]
    });
  }

  public highToLowOwned(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('isOwned', '==', true),
        where('approved', '==', true)
      ]
    });
  }

  public topSpace(space: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('space', '==', space),
        where('approved', '==', true)
      ]
    });
  }

  public lowToHighSpace(space: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'asc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('space', '==', space),
        where('approved', '==', true)
      ]
    });
  }

  public highToLowSpace(space: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('space', '==', space),
        where('approved', '==', true)
      ]
    });
  }

  // Collection - this includes unapproved.
  public lastCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'asc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('collection', '==', collection)
      ]
    });
  }

  public topCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('collection', '==', collection)
      ]
    });
  }

  public topPendingCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('isOwned', '==', false),
        where('approved', '==', false),
        where('rejected', '==', false),
        where('collection', '==', collection)
      ]
    });
  }

  public lowToHighPendingCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'asc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('isOwned', '==', false),
        where('approved', '==', false),
        where('rejected', '==', false),
        where('collection', '==', collection)
      ]
    });
  }

  public lowToHighCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'asc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('collection', '==', collection)
      ]
    });
  }

  public highToLowPendingCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('isOwned', '==', false),
        where('approved', '==', false),
        where('rejected', '==', false),
        where('collection', '==', collection)
      ]
    });
  }

  public highToLowCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('collection', '==', collection)
      ]
    });
  }

  public topAvailableCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('available', '==', NftAvailable.SALE),
        where('collection', '==', collection)
      ]
    });
  }

  public lowToHighAvailableCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'availablePrice',
      direction: 'asc',
      lastValue:  lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('available', '==', NftAvailable.SALE),
        where('collection', '==', collection)
      ]
    });
  }

  public highToLowAvailableCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'availablePrice',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('available', '==', NftAvailable.SALE),
        where('collection', '==', collection)
      ]
    });
  }

  public topAuctionCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('available', '==', NftAvailable.AUCTION),
        where('collection', '==', collection)
      ]
    });
  }

  public lowToHighAuctionCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'auctionHighestBid',
      direction: 'asc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('available', '==', NftAvailable.AUCTION),
        where('collection', '==', collection)
      ]
    });
  }

  public highToLowAuctionCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'auctionHighestBid',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('available', '==', NftAvailable.AUCTION),
        where('collection', '==', collection)
      ]
    });
  }

  public topOwnedCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('isOwned', '==', true),
        where('collection', '==', collection)
      ]
    });
  }

  public lowToHighOwnedCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'asc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('isOwned', '==', true),
        where('collection', '==', collection)
      ]
    });
  }

  public highToLowOwnedCollection(collection: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('isOwned', '==', true),
        where('collection', '==', collection)
      ]
    });
  }
  // COLLECTION END

  public positionInCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'position',
      direction: 'asc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('collection', '==', collection),
        where('hidden', '==', false)
      ]
    });
  }

  public recentlyChangedCollection(collection: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'updatedOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('collection', '==', collection),
        where('hidden', '==', false)
      ]
    });
  }

  public topMember(member: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'updatedOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('owner', '==', member)
      ]
    });
  }

  public topMemberByCollection(collection: string, member: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Nft[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'updatedOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('hidden', '==', false),
        where('owner', '==', member),
        where('collection', '==', collection)
      ]
    });
  }
}
