import { Injectable } from "@angular/core";
import { AngularFirestore } from "@angular/fire/compat/firestore";
import { AngularFireFunctions } from "@angular/fire/compat/functions";
import { COL } from "@functions/interfaces/models/base";
import { TokenPurchase } from "@functions/interfaces/models/token";
import * as dayjs from 'dayjs';
import { map, Observable } from "rxjs";
import { BaseApi } from "./base.api";

@Injectable({
  providedIn: 'root',
})
export class TokenPurchaseApi extends BaseApi<TokenPurchase> {
  public collection = COL.TOKEN_PURCHASE;
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }

  private getPurchases = (tokenId: string, days: number) => (ref: any) => ref
    .where('token', '==', tokenId)
    .where('createdOn', '>=', dayjs().subtract(days, 'd').toDate())

  private calcVolume = (purchases: TokenPurchase[]) =>
    purchases.reduce((sum, purchase) => sum + purchase.count, 0)

  private calcVWAP = (purchases: TokenPurchase[]) => {
    if (!purchases.length) {
      return 0
    }
    const high = purchases.reduce((max, act) => Math.max(max, act.price), Number.MIN_SAFE_INTEGER)
    const low = purchases.reduce((min, act) => Math.min(min, act.price), Number.MAX_SAFE_INTEGER)
    const close = purchases[0].price || 0
    const volume = this.calcVolume(purchases)
    const avg = (high + low + close) / 3
    return volume * avg / volume
  }

  private calcChangePrice24h = (purchases: TokenPurchase[]) => {
    if (purchases.length < 2) {
      return 0
    }
    const start = purchases[purchases.length - 1].price
    const close = purchases[0].price
    return (close - start) / start;
  }

  public listenVolume7d = (tokenId: string): Observable<number | undefined> => this._query({
    collection: COL.TOKEN_PURCHASE,
    refCust: this.getPurchases(tokenId, 7)
  }).pipe(map(this.calcVolume));

  public listenVolume24h = (tokenId: string): Observable<number | undefined> => this._query({
    collection: this.collection,
    refCust: this.getPurchases(tokenId, 1)
  }).pipe(map(this.calcVolume));

  public listenAvgPrice7d = (tokenId: string): Observable<number | undefined> => this._query({
    collection: this.collection,
    refCust: this.getPurchases(tokenId, 7)
  }).pipe(map(this.calcVWAP));

  public listenAvgPrice24h = (tokenId: string): Observable<number | undefined> => this._query({
    collection: this.collection,
    refCust: this.getPurchases(tokenId, 1)
  }).pipe(map(this.calcVWAP));

  public listenChangePrice24h = (tokenId: string): Observable<number | undefined> => this._query({
    collection: this.collection,
    refCust: this.getPurchases(tokenId, 1)
  }).pipe(map(this.calcChangePrice24h));

}
