import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Firestore, QueryConstraint, where } from '@angular/fire/firestore';
import { COL, TokenPurchase, TokenStatus, TokenTradeOrderType } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { Observable, map } from 'rxjs';
import { BaseApi, FULL_TODO_MOVE_TO_PROTOCOL } from './base.api';

const TRADE_HISTORY_SIZE = 100;

@Injectable({
  providedIn: 'root',
})
export class TokenPurchaseApi extends BaseApi<TokenPurchase> {
  public collection = COL.TOKEN_PURCHASE;

  constructor(protected firestore: Firestore, protected httpClient: HttpClient) {
    super(firestore, httpClient);
  }

  private getPurchases = (tokenId: string, tokenStatus: TokenStatus[], millis?: number) => {
    const constraints: QueryConstraint[] = [where('token', '==', tokenId)];
    constraints.push(where('tokenStatus', 'in', tokenStatus));
    if (millis !== undefined) {
      constraints.push(where('createdOn', '>=', dayjs().subtract(millis, 'ms').toDate()));
    }
    return constraints;
  };

  private calcChangePrice24h = (purchases: TokenPurchase[]) => {
    const split = dayjs().subtract(24, 'hours');
    const prevPurch: TokenPurchase[] = purchases.filter((b) => {
      return dayjs(b.createdOn?.toDate()).isBefore(split);
    });

    const afterPurch: TokenPurchase[] = purchases.filter((b) => {
      return dayjs(b.createdOn?.toDate()).isAfter(split);
    });

    if (prevPurch.length + afterPurch.length < 2) {
      return 0;
    }

    const start = this.calcVWAP(prevPurch);
    const close = this.calcVWAP(afterPurch);
    let fin = (close - start) / start;
    if (fin === Infinity) {
      fin = 0;
    }
    return fin;
  };

  public listenVolume7d = (
    tokenId: string,
    tokenStatus: TokenStatus[],
  ): Observable<number | undefined> =>
    this._query({
      collection: COL.TOKEN_PURCHASE,
      def: FULL_TODO_MOVE_TO_PROTOCOL,
      constraints: this.getPurchases(tokenId, tokenStatus, 7 * 24 * 60 * 60 * 1000),
    }).pipe(map(this.calcVolume));

  public listenVolume24h = (
    tokenId: string,
    tokenStatus: TokenStatus[],
  ): Observable<number | undefined> =>
    this._query({
      collection: this.collection,
      constraints: this.getPurchases(tokenId, tokenStatus, 24 * 60 * 60 * 1000),
    }).pipe(map(this.calcVolume));

  public listenAvgPrice7d = (
    tokenId: string,
    tokenStatus: TokenStatus[],
  ): Observable<number | undefined> =>
    this._query({
      collection: this.collection,
      def: FULL_TODO_MOVE_TO_PROTOCOL,
      constraints: this.getPurchases(tokenId, tokenStatus, 7 * 24 * 60 * 60 * 1000),
    }).pipe(map(this.calcVWAP));

  public listenChangePrice24h = (
    tokenId: string,
    tokenStatus: TokenStatus[],
  ): Observable<number | undefined> =>
    this._query({
      collection: this.collection,
      def: FULL_TODO_MOVE_TO_PROTOCOL,
      constraints: this.getPurchases(tokenId, tokenStatus, 2 * 24 * 60 * 60 * 1000),
    }).pipe(map(this.calcChangePrice24h));

  public listenToPurchases = (
    tokenId: string,
    tokenStatus: TokenStatus[],
  ): Observable<TokenPurchase[]> =>
    this._query({
      collection: this.collection,
      def: FULL_TODO_MOVE_TO_PROTOCOL,
      // Let's do max 1 month for now.
      constraints: this.getPurchases(tokenId, tokenStatus, 31 * 24 * 60 * 60 * 1000),
    });

  public tokenTopHistory = (
    tokenId: string,
    tokenStatus: TokenStatus[],
    def = TRADE_HISTORY_SIZE,
  ): Observable<TokenPurchase[]> =>
    this._query({
      collection: this.collection,
      def,
      constraints: this.getPurchases(tokenId, tokenStatus),
    });

  public tradeDetails = (
    marketId: string,
    type: TokenTradeOrderType,
  ): Observable<TokenPurchase[]> =>
    this._query({
      collection: this.collection,
      def: FULL_TODO_MOVE_TO_PROTOCOL,
      constraints: [where(type === TokenTradeOrderType.BUY ? 'buy' : 'sell', '==', marketId)],
    });
}
