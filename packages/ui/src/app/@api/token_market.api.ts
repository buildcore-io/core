import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Firestore, where } from '@angular/fire/firestore';
import {
  COL,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  WEN_FUNC,
  WenRequest,
} from '@soonaverse/interfaces';
import { Observable, combineLatest, map } from 'rxjs';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class TokenMarketApi extends BaseApi<TokenTradeOrder> {
  public collection = COL.TOKEN_MARKET;

  constructor(protected firestore: Firestore, protected httpClient: HttpClient) {
    super(firestore, httpClient);
  }

  private getBuyOrders = (tokenId: string) => [
    where('token', '==', tokenId),
    where('type', '==', TokenTradeOrderType.BUY),
  ];

  private getSellOrders = (tokenId: string) => [
    where('token', '==', tokenId),
    where('type', '==', TokenTradeOrderType.SELL),
  ];

  public bidsActive(
    token: string,
    lastValue?: number,
    def = DEFAULT_LIST_SIZE,
  ): Observable<TokenTradeOrder[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
      constraints: [
        where('token', '==', token),
        where('type', '==', TokenTradeOrderType.BUY),
        where('status', '==', TokenTradeOrderStatus.ACTIVE),
      ],
    });
  }

  public asksActive(
    token: string,
    lastValue?: number,
    def = DEFAULT_LIST_SIZE,
  ): Observable<TokenTradeOrder[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
      constraints: [
        where('token', '==', token),
        where('type', '==', TokenTradeOrderType.SELL),
        where('status', '==', TokenTradeOrderStatus.ACTIVE),
      ],
    });
  }

  public membersBids(
    member: string,
    token: string,
    lastValue?: number,
    def = DEFAULT_LIST_SIZE,
  ): Observable<TokenTradeOrder[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
      constraints: [
        where('token', '==', token),
        where('owner', '==', member),
        where('type', '==', TokenTradeOrderType.BUY),
      ],
    });
  }

  public membersAsks(
    member: string,
    token: string,
    lastValue?: number,
    def = DEFAULT_LIST_SIZE,
  ): Observable<TokenTradeOrder[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
      constraints: [
        where('token', '==', token),
        where('owner', '==', member),
        where('type', '==', TokenTradeOrderType.SELL),
      ],
    });
  }

  public listenAvgPrice = (tokenId: string): Observable<number | undefined> => {
    return combineLatest([
      this._query({
        collection: this.collection,
        orderBy: 'price',
        direction: 'asc',
        def: 1,
        constraints: [
          where('status', '==', TokenTradeOrderStatus.ACTIVE),
          where('token', '==', tokenId),
          where('type', '==', TokenTradeOrderType.SELL),
        ],
      }),
      this._query({
        collection: this.collection,
        orderBy: 'price',
        direction: 'desc',
        def: 1,
        constraints: [
          where('status', '==', TokenTradeOrderStatus.ACTIVE),
          where('token', '==', tokenId),
          where('type', '==', TokenTradeOrderType.BUY),
        ],
      }),
    ]).pipe(
      map(([lowestSell, highestBuy]) => {
        if (highestBuy?.length && lowestSell?.length) {
          return ((highestBuy?.[0]?.price || 0) + (lowestSell?.[0]?.price || 0)) / 2;
        } else {
          return 0;
        }
      }),
    );
  };

  public tradeToken(req: WenRequest): Observable<TokenTradeOrder | undefined> {
    return this.request(WEN_FUNC.tradeToken, req);
  }

  public cancel(req: WenRequest): Observable<TokenTradeOrder | undefined> {
    return this.request(WEN_FUNC.cancelTradeOrder, req);
  }
}
