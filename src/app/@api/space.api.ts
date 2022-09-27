import { Injectable } from '@angular/core';
import { doc, docData, Firestore, where } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { Space } from "functions/interfaces/models";
import { combineLatest, map, Observable, of } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress, SUB_COL, WenRequest } from '../../../functions/interfaces/models/base';
import { Member } from './../../../functions/interfaces/models/member';
import { BaseApi, DEFAULT_LIST_SIZE, WHERE_IN_BATCH } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class SpaceApi extends BaseApi<Space> {
  public collection = COL.SPACE;
  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
  }

  public listenMultiple(ids: EthAddress[]): Observable<Space[]> {
    const streams: Observable<Space[]>[] = [];
    for (let i = 0, j = ids.length; i < j; i += WHERE_IN_BATCH) {
      const batchToGet: string[] = ids.slice(i, i + WHERE_IN_BATCH);
      streams.push(this._query({
        collection: this.collection,
        orderBy: 'createdOn',
        direction: 'desc',
        constraints: [
          where('uid', 'in', batchToGet)
        ]
      }));
    }
    return combineLatest(streams).pipe(map((o) => {
      return o.flat(1);
    }));
  }

  public lastOpen(lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<Space[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'asc',
      lastValue: lastValue,
      def: def,
      constraints: [
        where('open', '==', true)
      ]
    });
  }

  public topOpen(lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<Space[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
      constraints: [
        where('open', '==', true)
      ]
    });
  }

  public isMemberWithinSpace(spaceId: string, memberId: string): Observable<boolean> {
    if (!spaceId || !memberId) {
      return of(false);
    }

    return docData(doc(this.firestore, this.collection, spaceId.toLowerCase(), SUB_COL.MEMBERS, memberId.toLowerCase())).pipe(
      map((o) => {
        return !!o;
      })
    );
  }

  public isGuardianWithinSpace(spaceId: string, memberId: string): Observable<boolean> {
    if (!spaceId || !memberId) {
      return of(false);
    }

    return docData(doc(this.firestore, this.collection, spaceId.toLowerCase(), SUB_COL.GUARDIANS, memberId.toLowerCase())).pipe(
      map((o) => {
        return !!o;
      })
    );
  }

  public isPendingMemberWithinSpace(spaceId: string, memberId: string): Observable<boolean> {
    if (!spaceId || !memberId) {
      return of(false);
    }

    return docData(doc(this.firestore, this.collection, spaceId.toLowerCase(), SUB_COL.KNOCKING_MEMBERS, memberId.toLowerCase())).pipe(
      map((o) => {
        return !!o;
      })
    );
  }

  public listenGuardians(spaceId: string, lastValue?: number, searchIds?: string[]): Observable<Member[]> {
    return this.subCollectionMembers({
      docId: spaceId,
      subCol: SUB_COL.GUARDIANS,
      lastValue: lastValue,
      searchIds: searchIds
    });
  }

  public listenMembersWithoutData(spaceId: string, lastValue?: number, searchIds?: string[], def?: number): Observable<Array<{uid: string}>> {
    return this.subCollectionMembersWithoutData({
      docId: spaceId,
      subCol: SUB_COL.MEMBERS,
      lastValue: lastValue,
      searchIds: searchIds,
      def: def
    });
  }

  public listenMembers(spaceId: string, lastValue?: number, searchIds?: string[], def?: number): Observable<Member[]> {
    return this.subCollectionMembers({
      docId: spaceId,
      subCol: SUB_COL.MEMBERS,
      lastValue: lastValue,
      searchIds: searchIds,
      def: def
    });
  }

  public listenBlockedMembers(spaceId: string, lastValue?: number, searchIds?: string[]): Observable<Member[]> {
    return this.subCollectionMembers({
      docId: spaceId,
      subCol: SUB_COL.BLOCKED_MEMBERS,
      lastValue: lastValue,
      searchIds: searchIds
    });
  }

  public listenPendingMembers(spaceId: string, lastValue?: number, searchIds?: string[]): Observable<Member[]> {
    return this.subCollectionMembers({
      docId: spaceId,
      subCol: SUB_COL.KNOCKING_MEMBERS,
      lastValue: lastValue,
      searchIds: searchIds
    });
  }

  public create(req: WenRequest): Observable<Space | undefined> {
    return this.request(WEN_FUNC.cSpace, req);
  }

  public save(req: WenRequest): Observable<Space | undefined> {
    return this.request(WEN_FUNC.uSpace, req);
  }

  public join(req: WenRequest): Observable<Space | undefined> {
    return this.request(WEN_FUNC.joinSpace, req);
  }

  public leave(req: WenRequest): Observable<Space | undefined> {
    return this.request(WEN_FUNC.leaveSpace, req);
  }

  public setGuardian(req: WenRequest): Observable<Space | undefined> {
    return this.request(WEN_FUNC.addGuardianSpace, req);
  }

  public removeGuardian(req: WenRequest): Observable<Space | undefined> {
    return this.request(WEN_FUNC.removeGuardianSpace, req);
  }

  public blockMember(req: WenRequest): Observable<Space | undefined> {
    return this.request(WEN_FUNC.blockMemberSpace, req);
  }

  public unblockMember(req: WenRequest): Observable<Space | undefined> {
    return this.request(WEN_FUNC.unblockMemberSpace, req);
  }

  public acceptMember(req: WenRequest): Observable<Space | undefined> {
    return this.request(WEN_FUNC.acceptMemberSpace, req);
  }

  public rejectMember(req: WenRequest): Observable<Space | undefined> {
    return this.request(WEN_FUNC.declineMemberSpace, req);
  }

  public update(req: WenRequest): Observable<Space | undefined> {
    return this.request(WEN_FUNC.uSpace, req);
  }
}
