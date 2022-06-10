import { Injectable } from "@angular/core";
import { AngularFirestore } from "@angular/fire/compat/firestore";
import { AngularFireFunctions } from "@angular/fire/compat/functions";
import { WEN_FUNC } from "@functions/interfaces/functions";
import { Transaction } from "@functions/interfaces/models";
import { COL, SUB_COL, WenRequest } from "@functions/interfaces/models/base";
import { Token, TokenDistribution } from "@functions/interfaces/models/token";
import { Observable, of } from "rxjs";
import { BaseApi, DEFAULT_LIST_SIZE } from "./base.api";

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

  public lowToHigh(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'pricePerToken',
      direction: 'asc',
      lastValue: lastValue,
      search: search,
      def: def,
      refCust: (ref: any) => {
        return ref.where('approved', '==', true);
      }
    });
  }

  public lowToHighStatus(status: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'price',
      direction: 'asc',
      lastValue: lastValue,
      search: search,
      def: def,
      refCust: (ref: any) => {
        return ref.where('approved', '==', true).where('status', '==', status);
      }
    });
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
        return ref.where('approved', '==', true);
      }
    });
  }

  public topStatus(status: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      refCust: (ref: any) => {
        return ref.where('approved', '==', true).where('status', '==', status);
      }
    });
  }

  public highToLow(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'pricePerToken',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      refCust: (ref: any) => {
        return ref.where('approved', '==', true);
      }
    });
  }

  public highToLowStatus(status: string, lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'pricePerToken',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      refCust: (ref: any) => {
        return ref.where('approved', '==', true).where('status', '==', status);
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
}
