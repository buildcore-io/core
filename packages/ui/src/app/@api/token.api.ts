import { HttpClient } from '@angular/common/http';
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
import {
  COL,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenStats,
  TokenStatus,
  Transaction,
  WEN_FUNC,
  WenRequest,
} from '@soonaverse/interfaces';
import { Observable, of } from 'rxjs';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class TokenApi extends BaseApi<Token> {
  public collection = COL.TOKEN;

  constructor(protected firestore: Firestore, protected httpClient: HttpClient) {
    super(firestore, httpClient);
  }

  public create(req: WenRequest): Observable<Token | undefined> {
    return this.request(WEN_FUNC.createToken, req);
  }

  public update(req: WenRequest): Observable<Token | undefined> {
    return this.request(WEN_FUNC.updateToken, req);
  }

  public setTokenAvailableForSale(req: WenRequest): Observable<Token | undefined> {
    return this.request(WEN_FUNC.setTokenAvailableForSale, req);
  }

  public vote(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.voteController, req);
  }

  public rank(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.rankController, req);
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

  public depositStake(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.depositStake, req);
  }

  public voteOnProposal(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.voteOnProposal, req);
  }

  public enableTrading(req: WenRequest): Observable<Token | undefined> {
    return this.request(WEN_FUNC.enableTokenTrading, req);
  }

  // TokenDistributionRepository.getByIdLive
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

  // TokenDistributionRepository.getAllLive
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

  // TokenStatsRepository.getByIdLive
  public stats(tokenId: string): Observable<TokenStats | undefined> {
    if (!tokenId) {
      return of(undefined);
    }

    return docData(
      doc(
        this.firestore,
        this.collection,
        tokenId.toLowerCase(),
        SUB_COL.STATS,
        tokenId.toLowerCase(),
      ),
    ) as Observable<TokenStats | undefined>;
  }

  // TokenRepository.getByStatusLive (first arg [])
  public topPublic(lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
      constraints: [where('public', '==', true)],
    });
  }

  // TokenRepository.getLatestLive
  public top(lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
    });
  }

  // TokenRepository.getBySpaceLive
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

  // TokenRepository.getByStatusLive
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

  // TokenRepository.getByStatusLive
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
