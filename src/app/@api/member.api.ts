import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollectionGroup } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { firstValueFrom, Observable, switchMap } from "rxjs";
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress, SUB_COL, WenRequest } from '../../../functions/interfaces/models/base';
import { Member } from './../../../functions/interfaces/models/member';
import { Space, SpaceMember } from './../../../functions/interfaces/models/space';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class MemberApi extends BaseApi<Member> {
  public collection = 'member';
  constructor(protected afs: AngularFirestore, private fns: AngularFireFunctions) {
    super(afs);
  }

  public listen(id: EthAddress): Observable<Member|undefined> {
    return super.listen(id);
  }

  public lastSpaces(memberId: EthAddress, def = 50): Observable<Space[]> {
    const ref: AngularFirestoreCollectionGroup<SpaceMember> = this.afs.collectionGroup<SpaceMember>(
      SUB_COL.MEMBERS,
      // We limit this to last record only. CreatedOn is always defined part of every record.
      (ref: any) => {
        return ref.where('uid', '==', memberId).orderBy('createdOn', 'asc').limitToLast(def);
      }
    );
    return ref.valueChanges().pipe(switchMap(async (obj: SpaceMember[]) => {
      const out: Space[] = [];
      for (const o of obj) {
        if (o.parentCol === COL.SPACE) {
          out.push(<any>await firstValueFrom(this.afs.collection(COL.SPACE).doc(o.parentId).valueChanges()));
        }
      }

      return out;
    }));
  }

  public allSpacesWhereGuardian(memberId: EthAddress): Observable<Space[]> {
    const ref: AngularFirestoreCollectionGroup<SpaceMember> = this.afs.collectionGroup<SpaceMember>(
      SUB_COL.GUARDIANS,
      // We limit this to last record only. CreatedOn is always defined part of every record.
      (ref: any) => {
        return ref.where('uid', '==', memberId)
      }
    );
    return ref.valueChanges().pipe(switchMap(async (obj: SpaceMember[]) => {
      const out: Space[] = [];
      for (const o of obj) {
        if (o.parentCol === COL.SPACE) {
          out.push(<any>await firstValueFrom(this.afs.collection(COL.SPACE).doc(o.parentId).valueChanges()));
        }
      }

      return out;
    }));
  }

  /**
   * Function to create profile if it does not exists yet.
   */
  public createIfNotExists(address: string): Observable<Member> {
    const callable = this.fns.httpsCallable(WEN_FUNC.cMemberNotExists);
    const data$ = callable(address);
    return data$;
  }

  /**
   * Function to update the member.
   */
  public updateMember(req: WenRequest): Observable<Member|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.uMember);
    const data$ = callable(req);
    return data$;
  }
}
