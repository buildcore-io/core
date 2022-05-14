import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollectionGroup } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Award } from '@functions/interfaces/models';
import { Token } from '@functions/interfaces/models/token';
import * as dayjs from 'dayjs';
import { map, Observable, switchMap } from "rxjs";
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress, SUB_COL, WenRequest } from '../../../functions/interfaces/models/base';
import { Member } from './../../../functions/interfaces/models/member';
import { Proposal } from './../../../functions/interfaces/models/proposal';
import { Space, SpaceGuardian, SpaceMember } from './../../../functions/interfaces/models/space';
import { Transaction, TransactionType } from './../../../functions/interfaces/models/transaction';
import { BaseApi, DEFAULT_LIST_SIZE, FULL_LIST } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class MemberApi extends BaseApi<Member> {
  public collection = 'member';
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }

  public listen(id: EthAddress): Observable<Member | undefined> {
    return super.listen(id);
  }

  public last(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE, linkedEntity?: number): Observable<Member[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'asc',
      lastValue: lastValue,
      search: search,
      def: def,
      refCust: (ref: any) => {
        return linkedEntity ? ref.where('linkedEntities', 'array-contains', linkedEntity) : ref;
      }
    });
  }

  public top(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE, linkedEntity?: number): Observable<Member[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def,
      refCust: (ref: any) => {
        return linkedEntity ? ref.where('linkedEntities', 'array-contains', linkedEntity) : ref;
      }
    });
  }

  public topTokens(memberId: EthAddress, _orderBy: string | string[] = 'createdOn', lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<Token[]> {
    return this.topParent({
      col: COL.TOKEN,
      subCol: SUB_COL.DISTRIBUTION,
      memberId: memberId,
      orderBy: [],
      lastValue: lastValue,
      def: def
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
  public topAwardsPending(memberId: EthAddress, orderBy: string | string[] = 'createdOn', lastValue?: number, def = FULL_LIST): Observable<Award[]> {
    return this.topParent({
      col: COL.AWARD,
      subCol: SUB_COL.PARTICIPANTS,
      memberId: memberId,
      orderBy: orderBy,
      lastValue: lastValue,
      def: def,
      refCust: (ref: any) => {
        return ref.where('completed', '==', false);
      }
    });
  }

  // TODO We need to tweak this to make sure don't filter locally.
  public topAwardsCompleted(memberId: EthAddress, orderBy: string | string[] = 'createdOn', lastValue?: number, def = FULL_LIST): Observable<Award[]> {
    return this.topParent({
      col: COL.AWARD,
      subCol: SUB_COL.PARTICIPANTS,
      memberId: memberId,
      orderBy: orderBy,
      lastValue: lastValue,
      def: def,
      refCust: (ref: any) => {
        return ref.where('completed', '==', true);
      }
    });
  }

  // TODO We need to tweak this to make sure don't filter locally.
  public topProposals(memberId: EthAddress, orderBy: string | string[] = 'createdOn', lastValue?: number, def = FULL_LIST): Observable<Proposal[]> {
    return this.topParent({
      col: COL.PROPOSAL,
      subCol: SUB_COL.MEMBERS,
      memberId: memberId,
      orderBy: orderBy,
      lastValue: lastValue,
      def: def,
      refCust: undefined,
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
      search: undefined,
      def: FULL_LIST,
      refCust: (ref: any) => {
        return ref.where('member', '==', memberId).where('type', '==', TransactionType.BADGE).where('payload.award', 'in', badgeId);
      }
    }).pipe(map((o) => {
      return o.length > 0;
    }));
  }

  public topBadges(memberId: string, orderBy: string | string[] = 'createdOn', lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<Transaction[]> {
    return this.afs.collection<Transaction>(
      COL.TRANSACTION,
      (ref) => {
        const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];
        let query: any = ref.where('member', '==', memberId).where('type', '==', TransactionType.BADGE);
        order.forEach((o) => {
          query = query.orderBy(o, 'desc');
        });

        if (lastValue) {
          query = query.startAfter(lastValue).limit(def);
        } else {
          query = query.limit(def);
        }

        return query;
      }
    ).valueChanges();
  }

  public topTransactions(memberId: string, orderBy: string | string[] = 'createdOn', lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<Transaction[]> {
    return this.afs.collection<Transaction>(
      COL.TRANSACTION,
      (ref) => {
        const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];
        let query: any = ref.where('member', '==', memberId).where('type', 'in', [TransactionType.PAYMENT, TransactionType.BILL_PAYMENT, TransactionType.CREDIT]);
        order.forEach((o) => {
          query = query.orderBy(o, 'desc');
        });

        if (lastValue) {
          query = query.startAfter(lastValue).limit(def);
        } else {
          query = query.limit(def);
        }

        return query;
      }
    ).valueChanges();
  }

  public allSpacesAsMember(memberId: EthAddress): Observable<Space[]> {
    const ref: AngularFirestoreCollectionGroup<SpaceMember> = this.afs.collectionGroup<SpaceMember>(
      SUB_COL.MEMBERS,
      (ref: any) => {
        return ref.where('uid', '==', memberId).where('parentCol', '==', COL.SPACE);
      }
    );
    return ref.valueChanges().pipe(switchMap(async(obj: SpaceMember[]) => {
      const out: Space[] = [];
      const subRecords: Space[] = await this.getSubRecordsInBatches(COL.SPACE, obj.map((o) => {
        return o.parentId;
      }));
      for (const o of obj) {
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
    }));
  }

  public allSpacesAsGuardian(memberId: EthAddress): Observable<Space[]> {
    const ref: AngularFirestoreCollectionGroup<SpaceGuardian> = this.afs.collectionGroup<SpaceGuardian>(
      SUB_COL.GUARDIANS,
      (ref: any) => {
        return ref.where('uid', '==', memberId).where('parentCol', '==', COL.SPACE);
      }
    );
    return ref.valueChanges().pipe(switchMap(async(obj: SpaceGuardian[]) => {
      const out: Space[] = [];
      const subRecords: Space[] = await this.getSubRecordsInBatches(COL.SPACE, obj.map((o) => {
        return o.parentId;
      }));
      for (const o of obj) {
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
    }));
  }

  public createIfNotExists(address: string): Observable<Member | undefined> {
    return this.request(WEN_FUNC.cMemberNotExists, address);
  }

  public updateMember(req: WenRequest): Observable<Member | undefined> {
    return this.request(WEN_FUNC.uMember, req);
  }
}
