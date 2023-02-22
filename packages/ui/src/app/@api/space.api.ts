import { Injectable } from '@angular/core';
import { doc, docData, Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { COL, Member, Space, SUB_COL, WenRequest, WEN_FUNC } from '@soonaverse/interfaces';
import { map, Observable, of } from 'rxjs';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class SpaceApi extends BaseApi<Space> {
  public collection = COL.SPACE;

  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
  }

  public isMemberWithinSpace(spaceId: string, memberId: string): Observable<boolean> {
    if (!spaceId || !memberId) {
      return of(false);
    }

    return docData(
      doc(
        this.firestore,
        this.collection,
        spaceId.toLowerCase(),
        SUB_COL.MEMBERS,
        memberId.toLowerCase(),
      ),
    ).pipe(
      map((o) => {
        return !!o;
      }),
    );
  }

  public isGuardianWithinSpace(spaceId: string, memberId: string): Observable<boolean> {
    if (!spaceId || !memberId) {
      return of(false);
    }

    return docData(
      doc(
        this.firestore,
        this.collection,
        spaceId.toLowerCase(),
        SUB_COL.GUARDIANS,
        memberId.toLowerCase(),
      ),
    ).pipe(
      map((o) => {
        return !!o;
      }),
    );
  }

  public isPendingMemberWithinSpace(spaceId: string, memberId: string): Observable<boolean> {
    if (!spaceId || !memberId) {
      return of(false);
    }

    return docData(
      doc(
        this.firestore,
        this.collection,
        spaceId.toLowerCase(),
        SUB_COL.KNOCKING_MEMBERS,
        memberId.toLowerCase(),
      ),
    ).pipe(
      map((o) => {
        return !!o;
      }),
    );
  }

  public listenGuardians(
    spaceId: string,
    lastValue?: number,
    searchIds?: string[],
  ): Observable<Member[]> {
    return this.subCollectionMembers({
      docId: spaceId,
      subCol: SUB_COL.GUARDIANS,
      lastValue: lastValue,
      searchIds: searchIds,
    });
  }

  public listenMembersWithoutData(
    spaceId: string,
    lastValue?: number,
    searchIds?: string[],
    def?: number,
  ): Observable<Array<{ uid: string }>> {
    return this.subCollectionMembersWithoutData({
      docId: spaceId,
      subCol: SUB_COL.MEMBERS,
      lastValue: lastValue,
      searchIds: searchIds,
      def: def,
    });
  }

  public listenMembers(
    spaceId: string,
    lastValue?: number,
    searchIds?: string[],
    def?: number,
  ): Observable<Member[]> {
    return this.subCollectionMembers({
      docId: spaceId,
      subCol: SUB_COL.MEMBERS,
      lastValue: lastValue,
      searchIds: searchIds,
      def: def,
    });
  }

  public listenBlockedMembers(
    spaceId: string,
    lastValue?: number,
    searchIds?: string[],
  ): Observable<Member[]> {
    return this.subCollectionMembers({
      docId: spaceId,
      subCol: SUB_COL.BLOCKED_MEMBERS,
      lastValue: lastValue,
      searchIds: searchIds,
    });
  }

  public listenPendingMembers(
    spaceId: string,
    lastValue?: number,
    searchIds?: string[],
  ): Observable<Member[]> {
    return this.subCollectionMembers({
      docId: spaceId,
      subCol: SUB_COL.KNOCKING_MEMBERS,
      lastValue: lastValue,
      searchIds: searchIds,
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

  public claimSpace(req: WenRequest): Observable<Space | undefined> {
    return this.request(WEN_FUNC.claimSpace, req);
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
