import { Injectable } from '@angular/core';
import { doc, docData, Firestore, where } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { Space } from "functions/interfaces/models";
import { map, Observable, of, switchMap } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress, SUB_COL, WenRequest } from '../../../functions/interfaces/models/base';
import { Member } from './../../../functions/interfaces/models/member';
import { Alliance } from './../../../functions/interfaces/models/space';
import { BaseApi, DEFAULT_LIST_SIZE, FULL_LIST } from './base.api';

export interface AllianceExtended extends Alliance {
  _record: Space;
}

export interface SpaceWithAlliances extends Space {
  alliances: {
    [propName: string]: AllianceExtended;
  };
}

@Injectable({
  providedIn: 'root',
})
export class SpaceApi extends BaseApi<Space> {
  public collection = COL.SPACE;
  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
  }

  public listen(id: EthAddress): Observable<SpaceWithAlliances | undefined> {
    return super.listen(id).pipe(switchMap(async(obj: Space | undefined) => {
      // Load space's alliances.
      const subRecords: Space[] = await this.getSubRecordsInBatches(COL.SPACE, Object.keys(obj?.alliances || {}));

      const finalObject: SpaceWithAlliances | undefined = <SpaceWithAlliances | undefined>obj;
      for (const o of subRecords) {
        if (finalObject) {
          finalObject.alliances[o.uid]._record = o;

          // If enabled === false remove.
          if (finalObject.alliances[o.uid].enabled === false) {
            delete finalObject.alliances[o.uid];
          }
        }

      }

      return finalObject;
    }));
  }

  public listenMultiple(ids: EthAddress[]): Observable<Space[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      def: FULL_LIST,
      constraints: [
        where('uid', 'in', ids)
      ]
    });
  }

  public lastOpen(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Space[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'asc',
      lastValue: lastValue,
      search: search,
      def: def,
      constraints: [
        where('open', '==', true)
      ]
    });
  }

  public topOpen(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Space[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
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

  public setAlliance(req: WenRequest): Observable<Space | undefined> {
    return this.request(WEN_FUNC.setAlliance, req);
  }

  public rejectMember(req: WenRequest): Observable<Space | undefined> {
    return this.request(WEN_FUNC.declineMemberSpace, req);
  }

  public update(req: WenRequest): Observable<Space | undefined> {
    return this.request(WEN_FUNC.uSpace, req);
  }
}
