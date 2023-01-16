import { Injectable } from '@angular/core';
import {
  collection,
  collectionData,
  collectionGroup,
  doc,
  docData,
  DocumentData,
  Firestore,
  getDocs,
  limit,
  orderBy as ordBy,
  query,
  QueryConstraint,
  startAfter,
  where,
} from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { environment } from '@env/environment';
import {
  Award,
  COL,
  EthAddress,
  Member,
  Proposal,
  SOON_TOKEN,
  SOON_TOKEN_TEST,
  Space,
  SpaceMember,
  Stake,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenDrop,
  TokenDropStatus,
  Transaction,
  TransactionType,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { combineLatest, filter, map, Observable, switchMap } from 'rxjs';
import { BaseApi, DEFAULT_LIST_SIZE, FULL_TODO_CHANGE_TO_PAGING, WHERE_IN_BATCH } from './base.api';

export interface TokenDistributionWithAirdrops extends TokenDistribution {
  tokenDrops: TokenDrop[];
}

export interface TokenWithMemberDistribution extends Token {
  distribution: TokenDistributionWithAirdrops;
}

export interface TransactionWithFullMember extends Transaction {
  memberRec?: Member;
}

export interface StakeWithTokenRec extends Stake {
  tokenRec: Token;
}

@Injectable({
  providedIn: 'root',
})
export class MemberApi extends BaseApi<Member> {
  public collection = 'member';

  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
  }

  public listen(id: EthAddress): Observable<Member | undefined> {
    return super.listen(id);
  }

  public soonDistributionStats(
    id: EthAddress,
  ): Observable<TokenDistributionWithAirdrops | undefined> {
    return docData(
      doc(
        this.firestore,
        COL.TOKEN,
        environment.production ? SOON_TOKEN : SOON_TOKEN_TEST,
        SUB_COL.DISTRIBUTION,
        id.toLowerCase(),
      ),
    ).pipe(
      switchMap(async (v) => {
        // We have to load the airdrops.
        const qr: any = await getDocs(
          query(
            collection(this.firestore, COL.AIRDROP),
            where('member', '==', id.toLowerCase()),
            where('token', '==', environment.production ? SOON_TOKEN : SOON_TOKEN_TEST),
          ),
        );

        v.tokenDrops = qr.docs
          ? qr.docs
              .filter((doc: DocumentData) => {
                return (<TokenDrop>doc.data()).status === TokenDropStatus.UNCLAIMED;
              })
              .map((doc: any) => {
                return <TokenDrop>doc.data();
              })
          : [];
        return v;
      }),
    ) as Observable<TokenDistributionWithAirdrops | undefined>;
  }

  public listenMultiple(ids: EthAddress[]): Observable<Member[]> {
    const streams: Observable<Member[]>[] = [];
    for (let i = 0, j = ids.length; i < j; i += WHERE_IN_BATCH) {
      const batchToGet: string[] = ids.slice(i, i + WHERE_IN_BATCH);
      streams.push(
        this._query({
          collection: this.collection,
          orderBy: 'createdOn',
          direction: 'asc',
          constraints: [where('uid', 'in', batchToGet)],
        }),
      );
    }
    return combineLatest(streams).pipe(
      map((o) => {
        return o.flat(1);
      }),
    );
  }

  public topStakes(
    memberId: EthAddress,
    _orderBy: string | string[] = 'createdOn',
    lastValue?: number,
    def = DEFAULT_LIST_SIZE,
  ): Observable<StakeWithTokenRec[]> {
    return this._query({
      collection: COL.STAKE,
      orderBy: 'expiresAt',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
      constraints: [...[where('member', '==', memberId)]],
    }).pipe(
      switchMap(async (obj: any[]) => {
        const out: StakeWithTokenRec[] = [];
        const subRecords: Token[] = await this.getSubRecordsInBatches(
          COL.TOKEN,
          obj.map((o) => {
            return o.token;
          }),
        );

        for (const o of obj) {
          const finObj: any = subRecords.find((subO: any) => {
            return subO.uid === o.token;
          });

          out.push({
            ...o,
            ...{
              tokenRec: finObj,
            },
          });
        }

        return out;
      }),
    );
  }

  public topTokens(
    memberId: EthAddress,
    _orderBy: string | string[] = 'createdOn',
    lastValue?: number,
    def = DEFAULT_LIST_SIZE,
  ): Observable<TokenWithMemberDistribution[]> {
    return this.topParent({
      col: COL.TOKEN,
      subCol: SUB_COL.DISTRIBUTION,
      memberId: memberId,
      orderBy: [],
      lastValue: lastValue,
      def: def,
      frRef: (obj: any, subCollection: any) => {
        obj.distribution = subCollection;
        return obj;
      },
    }).pipe(
      switchMap(async (v: TokenWithMemberDistribution[]) => {
        for (const t of v) {
          // We have to load the airdrops.
          const qr: any = await getDocs(
            query(
              collection(this.firestore, COL.AIRDROP),
              where('member', '==', memberId),
              where('token', '==', t.uid),
            ),
          );

          t.distribution.tokenDrops = qr.docs
            ? qr.docs
                .filter((doc: DocumentData) => {
                  return (<TokenDrop>doc.data()).status === TokenDropStatus.UNCLAIMED;
                })
                .map((doc: DocumentData) => {
                  return <TokenDrop>doc.data();
                })
            : [];
        }

        return v;
      }),
    );
  }

  public topSpaces(
    memberId: EthAddress,
    orderBy: string | string[] = 'createdOn',
    lastValue?: number,
    def = DEFAULT_LIST_SIZE,
  ): Observable<Space[]> {
    return this.topParent({
      col: COL.SPACE,
      subCol: SUB_COL.MEMBERS,
      memberId: memberId,
      orderBy: orderBy,
      lastValue: lastValue,
      def: def,
    });
  }

  public pendingSpaces(
    memberId: EthAddress,
    orderBy: string | string[] = 'createdOn',
    lastValue?: number,
    def = DEFAULT_LIST_SIZE,
  ): Observable<Space[]> {
    return this.topParent({
      col: COL.SPACE,
      subCol: SUB_COL.KNOCKING_MEMBERS,
      memberId: memberId,
      orderBy: orderBy,
      lastValue: lastValue,
      def: def,
    });
  }

  // TODO We need to tweak this to make sure don't filter locally.
  public topAwardsPending(
    memberId: EthAddress,
    orderBy: string | string[] = 'createdOn',
    lastValue?: number,
    def = FULL_TODO_CHANGE_TO_PAGING,
  ): Observable<Award[]> {
    return this.topParent({
      col: COL.AWARD,
      subCol: SUB_COL.PARTICIPANTS,
      memberId: memberId,
      orderBy: orderBy,
      lastValue: lastValue,
      def: def,
      constraints: [where('completed', '==', false)],
    });
  }

  // TODO We need to tweak this to make sure don't filter locally.
  public topAwardsCompleted(
    memberId: EthAddress,
    orderBy: string | string[] = 'createdOn',
    lastValue?: number,
    def = FULL_TODO_CHANGE_TO_PAGING,
  ): Observable<Award[]> {
    return this.topParent({
      col: COL.AWARD,
      subCol: SUB_COL.PARTICIPANTS,
      memberId: memberId,
      orderBy: orderBy,
      lastValue: lastValue,
      def: def,
      constraints: [where('completed', '==', true)],
    });
  }

  // TODO We need to tweak this to make sure don't filter locally.
  public topProposals(
    memberId: EthAddress,
    orderBy: string | string[] = 'createdOn',
    lastValue?: number,
    def = FULL_TODO_CHANGE_TO_PAGING,
  ): Observable<Proposal[]> {
    return this.topParent({
      col: COL.PROPOSAL,
      subCol: SUB_COL.MEMBERS,
      memberId: memberId,
      orderBy: orderBy,
      lastValue: lastValue,
      def: def,
      frRef: (obj: any) => {
        return (
          obj.settings.endDate?.toDate() &&
          dayjs(obj.settings.endDate.toDate()).isAfter(dayjs(new Date()))
        );
      },
    });
  }

  public hasBadge(memberId: EthAddress, badgeId: EthAddress[]): Observable<boolean> {
    return this._query({
      collection: COL.TRANSACTION,
      orderBy: 'createdOn',
      direction: 'asc',
      lastValue: undefined,
      def: 1,
      constraints: [
        where('member', '==', memberId),
        where('type', '==', TransactionType.BADGE),
        where('payload.award', 'in', badgeId),
      ],
    }).pipe(
      map((o) => {
        return o.length > 0;
      }),
    );
  }

  public topBadges(
    memberId: string,
    orderBy: string | string[] = 'createdOn',
    lastValue?: number,
    def = DEFAULT_LIST_SIZE,
  ): Observable<Transaction[]> {
    const constraints: QueryConstraint[] = [];
    const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];
    constraints.push(where('member', '==', memberId));
    constraints.push(where('type', '==', TransactionType.BADGE));
    order.forEach((o) => {
      constraints.push(ordBy(o, 'desc'));
    });

    if (lastValue) {
      constraints.push(startAfter(lastValue));
    }
    constraints.push(limit(def));

    return collectionData(
      query(collection(this.firestore, COL.TRANSACTION), ...constraints),
    ) as Observable<Transaction[]>;
  }

  public topTransactions(
    memberId: string,
    orderBy: string | string[] = 'createdOn',
    lastValue?: number,
    def = DEFAULT_LIST_SIZE,
  ): Observable<Transaction[]> {
    const includedTypes = [
      TransactionType.PAYMENT,
      TransactionType.BILL_PAYMENT,
      TransactionType.CREDIT,
      TransactionType.CREDIT_NFT,
      TransactionType.MINT_COLLECTION,
      TransactionType.WITHDRAW_NFT,
      TransactionType.MINT_TOKEN,
      TransactionType.UNLOCK,
    ];
    const constraints: QueryConstraint[] = [];
    const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];
    constraints.push(where('type', 'in', includedTypes));
    order.forEach((o) => {
      constraints.push(ordBy(o, 'desc'));
    });

    if (lastValue) {
      constraints.push(startAfter(lastValue));
    }

    constraints.push(limit(def));

    return combineLatest([
      collectionData(
        query(
          collection(this.firestore, COL.TRANSACTION),
          where('payload.previousOwner', '==', memberId),
          ...constraints,
        ),
      ).pipe(
        map((a: any) => {
          // It gets picked by the other search.
          return a.filter((t: any) => {
            return t.member !== memberId;
          });
        }),
      ),
      collectionData(
        query(
          collection(this.firestore, COL.TRANSACTION),
          where('member', '==', memberId),
          ...constraints,
        ),
      ),
    ]).pipe(
      filter(([previous, current]) => !!previous && !!current),
      map(([previous, current]) =>
        [...previous, ...current].sort(
          (a, b) =>
            -(a.createdOn?.toDate().getTime() || 0) + (b.createdOn?.toDate().getTime() || 0),
        ),
      ),
    ) as Observable<Transaction[]>;
  }

  public allSpacesAsMember(memberId: EthAddress): Observable<Space[]> {
    return collectionData(
      query(
        collectionGroup(this.firestore, SUB_COL.MEMBERS),
        where('uid', '==', memberId),
        where('parentCol', '==', COL.SPACE),
      ),
    ).pipe(
      switchMap(async (obj: DocumentData[]) => {
        const res = obj as SpaceMember[];
        const out: Space[] = [];
        const subRecords: Space[] = await this.getSubRecordsInBatches(
          COL.SPACE,
          res.map((o) => {
            return o.parentId;
          }),
        );
        for (const o of res) {
          const finObj: any = subRecords.find((subO: any) => {
            return subO.uid === o.parentId;
          });
          if (!finObj) {
            console.warn('Missing record in database');
          } else {
            out.push(finObj);
          }
        }

        return out;
      }),
    ) as Observable<Space[]>;
  }

  public createIfNotExists(address: string): Observable<Member | undefined> {
    return this.request(WEN_FUNC.cMemberNotExists, address);
  }

  public updateMember(req: WenRequest): Observable<Member | undefined> {
    return this.request(WEN_FUNC.uMember, req);
  }
}
