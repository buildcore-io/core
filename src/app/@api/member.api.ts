import { Injectable } from '@angular/core';
import { collection, collectionData, collectionGroup, DocumentData, Firestore, limit, orderBy as ordBy, query, QueryConstraint, startAfter, where } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { Award } from '@functions/interfaces/models';
import { Token, TokenDistribution } from '@functions/interfaces/models/token';
import dayjs from 'dayjs';
import { combineLatest, filter, map, Observable, switchMap } from "rxjs";
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress, SUB_COL, WenRequest } from '../../../functions/interfaces/models/base';
import { Member } from './../../../functions/interfaces/models/member';
import { Proposal } from './../../../functions/interfaces/models/proposal';
import { Space, SpaceMember } from './../../../functions/interfaces/models/space';
import { Transaction, TransactionType } from './../../../functions/interfaces/models/transaction';
import { BaseApi, DEFAULT_LIST_SIZE, FULL_TODO_CHANGE_TO_PAGING } from './base.api';

export interface TokenWithMemberDistribution extends Token {
  distribution: TokenDistribution;
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

  public listenMultiple(ids: EthAddress[]): Observable<Member[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'asc',
      constraints: [where('uid', 'in', ids)]
    });
  }

  public last(lastValue?: number, def = DEFAULT_LIST_SIZE, linkedEntity?: number): Observable<Member[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'asc',
      lastValue: lastValue,
      def: def,
      constraints: [
        ...(linkedEntity ? [where('linkedEntities', 'array-contains', linkedEntity)]: [])
      ]
    });
  }

  public top(lastValue?: number, def = DEFAULT_LIST_SIZE, linkedEntity?: number): Observable<Member[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
      constraints: [
        ...(linkedEntity ? [where('linkedEntities', 'array-contains', linkedEntity)]: [])
      ]
    });
  }

  public topTokens(memberId: EthAddress, _orderBy: string | string[] = 'createdOn', lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<TokenWithMemberDistribution[]> {
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
      }
    });
  }

  public topSpaces(memberId: EthAddress, orderBy: string | string[] = 'createdOn', lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<Space[]> {
    return this.topParent({
      col: COL.SPACE,
      subCol: SUB_COL.MEMBERS,
      memberId: memberId,
      orderBy: orderBy,
      lastValue: lastValue,
      def: def
    });
  }

  public pendingSpaces(memberId: EthAddress, orderBy: string | string[] = 'createdOn', lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<Space[]> {
    return this.topParent({
      col: COL.SPACE,
      subCol: SUB_COL.KNOCKING_MEMBERS,
      memberId: memberId,
      orderBy: orderBy,
      lastValue: lastValue,
      def: def
    });
  }

  // TODO We need to tweak this to make sure don't filter locally.
  public topAwardsPending(memberId: EthAddress, orderBy: string | string[] = 'createdOn', lastValue?: number, def = FULL_TODO_CHANGE_TO_PAGING): Observable<Award[]> {
    return this.topParent({
      col: COL.AWARD,
      subCol: SUB_COL.PARTICIPANTS,
      memberId: memberId,
      orderBy: orderBy,
      lastValue: lastValue,
      def: def,
      constraints: [
        where('completed', '==', false)
      ]
    });
  }

  // TODO We need to tweak this to make sure don't filter locally.
  public topAwardsCompleted(memberId: EthAddress, orderBy: string | string[] = 'createdOn', lastValue?: number, def = FULL_TODO_CHANGE_TO_PAGING): Observable<Award[]> {
    return this.topParent({
      col: COL.AWARD,
      subCol: SUB_COL.PARTICIPANTS,
      memberId: memberId,
      orderBy: orderBy,
      lastValue: lastValue,
      def: def,
      constraints: [
        where('completed', '==', true)
      ]
    });
  }

  // TODO We need to tweak this to make sure don't filter locally.
  public topProposals(memberId: EthAddress, orderBy: string | string[] = 'createdOn', lastValue?: number, def = FULL_TODO_CHANGE_TO_PAGING): Observable<Proposal[]> {
    return this.topParent({
      col: COL.PROPOSAL,
      subCol: SUB_COL.MEMBERS,
      memberId: memberId,
      orderBy: orderBy,
      lastValue: lastValue,
      def: def,
      frRef: (obj: any) => {
        return (obj.settings.endDate?.toDate() && dayjs(obj.settings.endDate.toDate()).isAfter(dayjs(new Date())));
      }
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
        where('payload.award', 'in', badgeId)
      ]
    }).pipe(map((o) => {
      return o.length > 0;
    }));
  }

  public topBadges(memberId: string, orderBy: string | string[] = 'createdOn', lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<Transaction[]> {
    const constraints: QueryConstraint[] = [];
    const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];
    constraints.push(where('member', '==', memberId));
    constraints.push(where('type', '==', TransactionType.BADGE))
    order.forEach((o) => {
      constraints.push(ordBy(o, 'desc'));
    });

    if (lastValue) {
      constraints.push(startAfter(lastValue));
    }
    constraints.push(limit(def));

    return collectionData(
      query(
        collection(this.firestore, COL.TRANSACTION),
        ...constraints
      )
    ) as Observable<Transaction[]>;
  }

  public topTransactions(memberId: string, orderBy: string | string[] = 'createdOn', lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<Transaction[]> {
    const includedTypes = [
      TransactionType.PAYMENT,
      TransactionType.BILL_PAYMENT,
      TransactionType.CREDIT_NFT,
      TransactionType.MINT_COLLECTION,
      TransactionType.WITHDRAW_NFT,
      TransactionType.MINT_TOKEN
    ];
    const constraints: QueryConstraint[] = [];
    const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];
    constraints.push(where('type', 'in', includedTypes));
    order.forEach((o) => {
      constraints.push(ordBy(o, 'desc'));
    });

    if (lastValue) {
      constraints.push(startAfter(lastValue))
    }

    constraints.push(limit(def));

    return combineLatest([
      collectionData(
        query(
          collection(this.firestore, COL.TRANSACTION),
          where('payload.previousOwner', '==', memberId),
          ...constraints
        )
      ),
      collectionData(
        query(
          collection(this.firestore, COL.TRANSACTION),
          where('member', '==', memberId),
          ...constraints
        )
      )
    ]).pipe(
      filter(([previous, current]) => !!previous && !!current),
      map(([previous, current]) =>
        [...previous, ...current]
          .sort((a, b) => -(a.createdOn?.toDate().getTime() || 0) + (b.createdOn?.toDate().getTime() || 0)))
    ) as Observable<Transaction[]>;
  }

  public allSpacesAsMember(memberId: EthAddress): Observable<Space[]> {
    return collectionData(
      query(
        collectionGroup(this.firestore, SUB_COL.MEMBERS),
        where('uid', '==', memberId),
        where('parentCol', '==', COL.SPACE)
      )
    ).pipe(switchMap(async(obj: DocumentData[]) => {
      const res = obj as SpaceMember[];
      const out: Space[] = [];
      const subRecords: Space[] = await this.getSubRecordsInBatches(COL.SPACE, res.map((o) => {
        return o.parentId;
      }));
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
    })) as Observable<Space[]>;
  }

  public allSpacesAsGuardian(memberId: EthAddress): Observable<Space[]> {
    return collectionData(
      query(
        collectionGroup(this.firestore, SUB_COL.GUARDIANS),
        where('uid', '==', memberId),
        where('parentCol', '==', COL.SPACE)
      )
    ).pipe(switchMap(async(obj: DocumentData[]) => {
      const res = obj as SpaceMember[];
      const out: Space[] = [];
      const subRecords: Space[] = await this.getSubRecordsInBatches(COL.SPACE, res.map((o) => {
        return o.parentId;
      }));
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
    })) as Observable<Space[]>;
  }

  public createIfNotExists(address: string): Observable<Member | undefined> {
    return this.request(WEN_FUNC.cMemberNotExists, address);
  }

  public updateMember(req: WenRequest): Observable<Member | undefined> {
    return this.request(WEN_FUNC.uMember, req);
  }
}
