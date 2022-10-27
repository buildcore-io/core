import { Injectable } from '@angular/core';
import {
  collection,
  collectionData,
  doc,
  docData,
  Firestore,
  query,
  where,
} from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import {
  COL,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenStatus,
  Transaction,
  WenRequest,
  WEN_FUNC,
} from '@soon/interfaces';
import { Observable, of } from 'rxjs';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class TokenApi extends BaseApi<Token> {
  public collection = COL.TOKEN;

  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
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

  public airdropMintedToken(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.airdropMintedToken, req);
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

  public getMembersDistribution(
    tokenId: string,
    memberId: string,
  ): Observable<TokenDistribution | undefined> {
    if (!tokenId || !memberId) {
      return of(undefined);
    }

    return docData(
      doc(
        this.firestore,
        this.collection,
        tokenId.toLowerCase(),
        SUB_COL.DISTRIBUTION,
        memberId.toLowerCase(),
      ),
    ) as Observable<TokenDistribution | undefined>;
  }

  public getDistributions(tokenId?: string): Observable<TokenDistribution[] | undefined> {
    if (!tokenId) {
      return of(undefined);
    }

    return collectionData(
      query(
        collection(this.firestore, this.collection, tokenId.toLowerCase(), SUB_COL.DISTRIBUTION),
      ),
    ) as Observable<TokenDistribution[]>;
  }

  public top(lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
      constraints: [where('public', '==', true)],
    });
  }

  public space(space: string, lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
      constraints: [where('space', '==', space)],
    });
  }

  public tradingPairs(lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
      constraints: [
        where('public', '==', true),
        where('status', 'in', [TokenStatus.BASE, TokenStatus.PRE_MINTED, TokenStatus.MINTED]),
      ],
    });
  }

  public launchpad(lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
      constraints: [where('public', '==', true), where('status', 'in', [TokenStatus.AVAILABLE])],
    });
  }
}