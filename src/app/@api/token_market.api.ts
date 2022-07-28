import { Injectable } from "@angular/core";
import { AngularFirestore } from "@angular/fire/compat/firestore";
import { AngularFireFunctions } from "@angular/fire/compat/functions";
import { WEN_FUNC } from "@functions/interfaces/functions";
import { COL, WenRequest } from "@functions/interfaces/models/base";
import { TokenTradeOrder, TokenTradeOrderStatus, TokenTradeOrderType } from "@functions/interfaces/models/token";
import { map, Observable } from "rxjs";
import { BaseApi, DEFAULT_LIST_SIZE } from "./base.api";

@Injectable({
  providedIn: 'root',
})
export class TokenMarketApi extends BaseApi<TokenTradeOrder> {
  public collection = COL.TOKEN_MARKET;
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }

  private getBuyOrders = (tokenId: string) => (ref: any) => ref
    .where('token', '==', tokenId).where('type', '==', TokenTradeOrderType.BUY);

  private getSellOrders = (tokenId: string) => (ref: any) => ref
    .where('token', '==', tokenId).where('type', '==', TokenTradeOrderType.SELL);

  public bidsActive(token: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<TokenTradeOrder[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      refCust: (ref: any) => {
        return ref.where('token', '==', token).where('type', '==', TokenTradeOrderType.BUY).where('status', '==', TokenTradeOrderStatus.ACTIVE);
      }
    });
  }

  public asksActive(token: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<TokenTradeOrder[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      refCust: (ref: any) => {
        return ref.where('token', '==', token).where('type', '==', TokenTradeOrderType.SELL).where('status', '==', TokenTradeOrderStatus.ACTIVE);
      }
    });
  }

  public membersBids(member: string, token: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<TokenTradeOrder[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      refCust: (ref: any) => {
        return ref.where('token', '==', token).where('owner', '==', member).where('type', '==', TokenTradeOrderType.BUY);
      }
    });
  }

  public membersAsks(member: string, token: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<TokenTradeOrder[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      refCust: (ref: any) => {
        return ref.where('token', '==', token).where('owner', '==', member).where('type', '==', TokenTradeOrderType.SELL);
      }
    });
  }

  public sellToken(req: WenRequest): Observable<TokenTradeOrder | undefined> {
    return this.request(WEN_FUNC.sellToken, req);
  }

  public sellMintedToken(req: WenRequest): Observable<TokenTradeOrder | undefined> {
    return this.request(WEN_FUNC.sellMintedToken, req);
  }

  public buyToken(req: WenRequest): Observable<TokenTradeOrder | undefined> {
    return this.request(WEN_FUNC.buyToken, req);
  }

  public cancel(req: WenRequest): Observable<TokenTradeOrder | undefined> {
    return this.request(WEN_FUNC.cancelTradeOrder, req);
  }

  public listenToAvgBuy = (tokenId: string): Observable<number | undefined> => this._query({
    collection: this.collection,
    refCust: this.getBuyOrders(tokenId)
  }).pipe(map(this.calcVWAP));

  public listenToAvgSell = (tokenId: string): Observable<number | undefined> => this._query({
    collection: this.collection,
    refCust: this.getSellOrders(tokenId)
  }).pipe(map(this.calcVWAP));
}
