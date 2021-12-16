import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Space, SpaceGuardian } from "functions/interfaces/models";
import { map, Observable, of } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress, SUB_COL, WenRequest } from '../../../functions/interfaces/models/base';
import { Member } from './../../../functions/interfaces/models/member';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class SpaceApi extends BaseApi<Space> {
  public collection = COL.SPACE;
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }

  public listen(id: EthAddress): Observable<Space|undefined> {
    return super.listen(id);
  }

  public lastOpen(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Space[]> {
    return this._query(this.collection, 'createdOn', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('open', '==', true);
    });
  }

  public topOpen(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Space[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('open', '==', true);
    });
  }

  public isMemberWithinSpace(spaceId: string, memberId: string): Observable<boolean> {
    if (!spaceId || !memberId) {
      return of(false);
    }

    return this.afs.collection(this.collection).doc(spaceId.toLowerCase()).collection(SUB_COL.MEMBERS).doc<SpaceGuardian>(memberId.toLowerCase()).valueChanges().pipe(
      map((o) => {
        return !!o;
      })
    );
  }

  public isGuardianWithinSpace(spaceId: string, memberId: string): Observable<boolean> {
    if (!spaceId || !memberId) {
      return of(false);
    }

    return this.afs.collection(this.collection).doc(spaceId.toLowerCase()).collection(SUB_COL.GUARDIANS).doc<SpaceGuardian>(memberId.toLowerCase()).valueChanges().pipe(
      map((o) => {
        return !!o;
      })
    );
  }

  public isPendingMemberWithinSpace(spaceId: string, memberId: string): Observable<boolean> {
    if (!spaceId || !memberId) {
      return of(false);
    }

    return this.afs.collection(this.collection).doc(spaceId.toLowerCase()).collection(SUB_COL.KNOCKING_MEMBERS).doc<SpaceGuardian>(memberId.toLowerCase()).valueChanges().pipe(
      map((o) => {
        return !!o;
      })
    );
  }

  public listenGuardians(spaceId: string, lastValue?: any, searchIds?: string[]): Observable<Member[]> {
    return this.subCollectionMembers(spaceId, SUB_COL.GUARDIANS, lastValue, searchIds);
  }

  public listenMembers(spaceId: string, lastValue?: any, searchIds?: string[]): Observable<Member[]> {
    return this.subCollectionMembers(spaceId, SUB_COL.MEMBERS, lastValue, searchIds);
  }

  public listenBlockedMembers(spaceId: string, lastValue?: any, searchIds?: string[]): Observable<Member[]> {
    return this.subCollectionMembers(spaceId, SUB_COL.BLOCKED_MEMBERS, lastValue, searchIds);
  }

  public listenPendingMembers(spaceId: string, lastValue?: any, searchIds?: string[]): Observable<Member[]> {
    return this.subCollectionMembers(spaceId, SUB_COL.KNOCKING_MEMBERS, lastValue, searchIds);
  }

  public create(req: WenRequest): Observable<Space|undefined> {
    return this.request(WEN_FUNC.cSpace, req);
  }

  public save(req: WenRequest): Observable<Space|undefined> {
    return this.request(WEN_FUNC.uSpace, req);
  }

  public join(req: WenRequest): Observable<Space|undefined> {
    return this.request(WEN_FUNC.joinSpace, req);
  }

  public leave(req: WenRequest): Observable<Space|undefined> {
    return this.request(WEN_FUNC.leaveSpace, req);
  }

   public setGuardian(req: WenRequest): Observable<Space|undefined> {
    return this.request(WEN_FUNC.addGuardianSpace, req);
  }

  public removeGuardian(req: WenRequest): Observable<Space|undefined> {
    return this.request(WEN_FUNC.removeGuardianSpace, req);
  }

  public blockMember(req: WenRequest): Observable<Space|undefined> {
    return this.request(WEN_FUNC.blockMemberSpace, req);
  }

  public unblockMember(req: WenRequest): Observable<Space|undefined> {
    return this.request(WEN_FUNC.unblockMemberSpace, req);
  }

  public acceptMember(req: WenRequest): Observable<Space|undefined> {
    return this.request(WEN_FUNC.acceptMemberSpace, req);
  }

  public rejectMember(req: WenRequest): Observable<Space|undefined> {
    return this.request(WEN_FUNC.declineMemberSpace, req);
  }

  public update(req: WenRequest): Observable<Space|undefined> {
    return this.request(WEN_FUNC.uSpace, req);
  }
}
