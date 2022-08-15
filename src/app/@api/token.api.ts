import { Injectable } from "@angular/core";
import { AngularFirestore } from "@angular/fire/compat/firestore";
import { AngularFireFunctions } from "@angular/fire/compat/functions";
import { WEN_FUNC } from "@functions/interfaces/functions";
import { Transaction } from "@functions/interfaces/models";
import { COL, EthAddress, SUB_COL, WenRequest } from "@functions/interfaces/models/base";
import { Token, TokenDistribution, TokenStatus } from "@functions/interfaces/models/token";
import { Observable, of } from "rxjs";
import { BaseApi, DEFAULT_LIST_SIZE, FULL_LIST } from "./base.api";

@Injectable({
  providedIn: 'root',
})
export class TokenApi extends BaseApi<Token> {
  public collection = COL.TOKEN;
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }

  public create(req: WenRequest): Observable<Token | undefined> {
    return this.request(WEN_FUNC.cToken, req);
  }

  public update(req: WenRequest): Observable<Token | undefined> {
    return this.request(WEN_FUNC.uToken, req);
  }

  public setTokenAvailableForSale(req: WenRequest): Observable<Token | undefined> {
    return this.request(WEN_FUNC.setTokenAvailableForSale, req);
  }

  public cancelPublicSale(req: WenRequest): Observable<Token | undefined> {
    return this.request(WEN_FUNC.cancelPublicSale, req);
  }

  public airdropToken(req: WenRequest): Observable<TokenDistribution[] | undefined> {
    return this.request(WEN_FUNC.airdropToken, req);
  }

  public creditToken(req: WenRequest): Observable<Transaction[] | undefined> {
    return this.request(WEN_FUNC.creditToken, req);
  }

  public claimAirdroppedToken(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.claimAirdroppedToken, req);
  }

  public claimMintedToken(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.claimMintedTokenOrder, req);
  }

  public getMembersDistribution(tokenId: string, memberId: string): Observable<TokenDistribution | undefined> {
    if (!tokenId || !memberId) {
      return of(undefined);
    }

    return this.afs.collection(this.collection).doc(tokenId.toLowerCase()).collection(SUB_COL.DISTRIBUTION).doc<TokenDistribution>(memberId.toLowerCase()).valueChanges();
  }

  public getDistributions(tokenId?: string): Observable<TokenDistribution[] | undefined> {
    if (!tokenId) {
      return of(undefined);
    }

    return this.afs.collection(this.collection).doc(tokenId.toLowerCase()).collection(SUB_COL.DISTRIBUTION).valueChanges() as Observable<TokenDistribution[]>;
  }

  public top(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      refCust: (ref: any) => {
        return ref.where('public', '==', true);
      }
    });
  }

  public space(space: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      refCust: (ref: any) => {
        return ref.where('space', '==', space);
      }
    });
  }

  public listenMultiple(ids: EthAddress[]): Observable<Token[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      def: FULL_LIST,
      refCust: (ref: any) => {
        return ref.where('uid', 'in', ids);
      }
    });
  }

  public allPairs(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      refCust: (ref: any) => {
        return ref.where('public', '==', true).where('status', 'in', [TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED, TokenStatus.MINTED]);
      }
    });
  }

  public tradingPairs(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      refCust: (ref: any) => {
        return ref.where('public', '==', true).where('status', 'in', [TokenStatus.PRE_MINTED, TokenStatus.MINTED]);
      }
    });
  }

  public launchpad(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      refCust: (ref: any) => {
        return ref.where('public', '==', true).where('status', 'in', [TokenStatus.AVAILABLE]);
      }
    });
  }
}
