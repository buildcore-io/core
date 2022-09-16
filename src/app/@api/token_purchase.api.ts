import { Injectable } from "@angular/core";
import { Firestore, QueryConstraint, where } from "@angular/fire/firestore";
import { Functions } from "@angular/fire/functions";
import { COL } from "@functions/interfaces/models/base";
import { TokenPurchase, TokenTradeOrderType } from "@functions/interfaces/models/token";
import dayjs from 'dayjs';
import { map, Observable } from "rxjs";
import { BaseApi, FULL_LIST } from "./base.api";

const TRADE_HISTORY_SIZE = 100;

@Injectable({
  providedIn: 'root',
})
export class TokenPurchaseApi extends BaseApi<TokenPurchase> {
  public collection = COL.TOKEN_PURCHASE;
  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
  }

  private getPurchases = (tokenId: string, millis?: number) => {
    const constraints: QueryConstraint[] = [where('token', '==', tokenId)];
    if (millis !== undefined) {
      constraints.push(where('createdOn', '>=', dayjs().subtract(millis, 'ms').toDate()));
    }
    return constraints;
  }

  private calcChangePrice24h = (purchases: TokenPurchase[]) => {
    const split = dayjs().subtract(24, 'hours');
    const prevPurch: TokenPurchase[] = purchases.filter((b) => {
      return (dayjs(b.createdOn?.toDate()).isBefore(split));
    });

    const afterPurch: TokenPurchase[] = purchases.filter((b) => {
      return (dayjs(b.createdOn?.toDate()).isAfter(split));
    });

    if ((prevPurch.length + afterPurch.length) < 2) {
      return 0;
    }

    const start = this.calcVWAP(prevPurch);
    const close = this.calcVWAP(afterPurch);
    return (close - start) / start;
  }

  public listenVolume7d = (tokenId: string): Observable<number | undefined> => this._query({
    collection: COL.TOKEN_PURCHASE,
    def: FULL_LIST,
    constraints: this.getPurchases(tokenId, 7 * 24 * 60 * 60 * 1000)
  }).pipe(map(this.calcVolume));

  public listenVolume24h = (tokenId: string): Observable<number | undefined> => this._query({
    collection: this.collection,
    constraints: this.getPurchases(tokenId, 1 * 24 * 60 * 60 * 1000)
  }).pipe(map(this.calcVolume));

  public listenAvgPrice1m = (tokenId: string): Observable<number | undefined> => this._query({
    collection: this.collection,
    def: FULL_LIST,
    constraints: this.getPurchases(tokenId, 60 * 1000)
  }).pipe(map(this.calcVWAP));

  public listenAvgPrice7d = (tokenId: string): Observable<number | undefined> => this._query({
    collection: this.collection,
    def: FULL_LIST,
    constraints: this.getPurchases(tokenId, 7 * 24 * 60 * 60 * 1000)
  }).pipe(map(this.calcVWAP));

  public listenAvgPrice24h = (tokenId: string): Observable<number | undefined> => this._query({
    collection: this.collection,
    def: FULL_LIST,
    constraints: this.getPurchases(tokenId, 1 * 24 * 60 * 60 * 1000)
  }).pipe(map(this.calcVWAP));

  public listenChangePrice24h = (tokenId: string): Observable<number | undefined> => this._query({
    collection: this.collection,
    def: FULL_LIST,
    constraints: this.getPurchases(tokenId, 2 * 24 * 60 * 60 * 1000)
  }).pipe(map(this.calcChangePrice24h));

  public listenToPurchases1m = (tokenId: string): Observable<TokenPurchase[]> => this._query({
    collection: this.collection,
    def: FULL_LIST,
    constraints: this.getPurchases(tokenId, 60 * 1000)
  });

  public listenToPurchases24h = (tokenId: string): Observable<TokenPurchase[]> => this._query({
    collection: this.collection,
    def: FULL_LIST,
    constraints: this.getPurchases(tokenId, 1 * 24 * 60 * 60 * 1000)
  });

  public listenToPurchases7d = (tokenId: string): Observable<TokenPurchase[]> => this._query({
    collection: this.collection,
    def: FULL_LIST,
    constraints: this.getPurchases(tokenId, 7 * 24 * 60 * 60 * 1000)
  });

  public tokenTopHistory = (tokenId: string, def = TRADE_HISTORY_SIZE): Observable<TokenPurchase[]> => this._query({
    collection: this.collection,
    def,
    constraints: this.getPurchases(tokenId)
  });

  public tradeDetails = (marketId: string, type: TokenTradeOrderType): Observable<TokenPurchase[]> => this._query({
    collection: this.collection,
    def: FULL_LIST,
    constraints: [
      where(type === TokenTradeOrderType.BUY ? 'buy' : 'sell', '==', marketId)
    ]
  });
}
