import { Injectable } from "@angular/core";
import { AngularFirestore } from "@angular/fire/compat/firestore";
import { AngularFireFunctions } from "@angular/fire/compat/functions";
import { COL } from "@functions/interfaces/models/base";
import { TokenPurchase } from "@functions/interfaces/models/token";
import * as dayjs from 'dayjs';
import { map, Observable } from "rxjs";
import { BaseApi, FULL_LIST } from "./base.api";

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
    def: FULL_LIST,
    refCust: this.getPurchases(tokenId, 7)
  }).pipe(map(this.calcVolume));

  public listenVolume24h = (tokenId: string): Observable<number | undefined> => this._query({
    collection: this.collection,
    refCust: this.getPurchases(tokenId, 1)
  }).pipe(map(this.calcVolume));

  public listenAvgPrice7d = (tokenId: string): Observable<number | undefined> => this._query({
    collection: this.collection,
    def: FULL_LIST,
    refCust: this.getPurchases(tokenId, 7)
  }).pipe(map(this.calcVWAP));

  public listenAvgPrice24h = (tokenId: string): Observable<number | undefined> => this._query({
    collection: this.collection,
    def: FULL_LIST,
    refCust: this.getPurchases(tokenId, 1)
  }).pipe(map(this.calcVWAP));

  public listenChangePrice24h = (tokenId: string): Observable<number | undefined> => this._query({
    collection: this.collection,
    def: FULL_LIST,
    refCust: this.getPurchases(tokenId, 1)
  }).pipe(map(this.calcChangePrice24h));

  public listenToPurchases24h = (tokenId: string): Observable<TokenPurchase[]> => this._query({
    collection: this.collection,
    def: FULL_LIST,
    refCust: this.getPurchases(tokenId, 1)
  });

  public listenToPurchases7d = (tokenId: string): Observable<TokenPurchase[]> => this._query({
    collection: this.collection,
    def: FULL_LIST,
    refCust: this.getPurchases(tokenId, 7)
  });
}
