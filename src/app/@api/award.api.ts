import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Award } from "functions/interfaces/models";
import { firstValueFrom, Observable, switchMap } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress, SUB_COL, Timestamp, WenRequest } from '../../../functions/interfaces/models/base';
import { AwardOwner, AwardParticipant } from './../../../functions/interfaces/models/award';
import { Member } from './../../../functions/interfaces/models/member';
import { BaseApi } from './base.api';

export interface AwardParticipantWithMember extends Member {
  comment?: string;
  participatedOn: Timestamp;
}

export enum AwardFilter {
  ALL,
  ACTIVE,
  COMPLETED
}

@Injectable({
  providedIn: 'root',
})
export class AwardApi extends BaseApi<Award> {
  public collection = COL.AWARD;
  constructor(protected afs: AngularFirestore, private fns: AngularFireFunctions) {
    super(afs);
  }

  public listen(id: EthAddress): Observable<Award|undefined> {
    return super.listen(id);
  }

  public listenForSpace(space: string, filter: AwardFilter = AwardFilter.ALL): Observable<Award[]> {
    return this.afs.collection<Award>(
      this.collection,
      // We limit this to last record only. CreatedOn is always defined part of every record.
      (ref) => {
        let fResult: any = ref.where('space', '==', space);
        if (filter === AwardFilter.ACTIVE) {
          fResult = fResult.where('completed', '==', false);
        } else if (filter === AwardFilter.COMPLETED) {
          fResult = fResult.where('completed', '==', true);
        }

        return fResult;
      }
    ).valueChanges();
  }

  public listenOwners(awardId: string): Observable<Member[]> {
    return (<Observable<AwardParticipant[]>>this.afs.collection(this.collection)
    .doc(awardId.toLowerCase()).collection(SUB_COL.OWNERS).valueChanges()).pipe(switchMap(async (obj: AwardOwner[]) => {
      const out: Member[] = [];
      for (const o of obj) {
        out.push(<any>await firstValueFrom(this.afs.collection(COL.MEMBER).doc(o.uid).valueChanges()));
      }

      return out;
    }));
  }

  public listenParticipants(awardId: string): Observable<AwardParticipantWithMember[]> {
    return (<Observable<AwardParticipant[]>>this.afs.collection(this.collection)
    .doc(awardId.toLowerCase()).collection(SUB_COL.PARTICIPANTS).valueChanges()).pipe(switchMap(async (obj: AwardParticipant[]) => {
      const out: AwardParticipantWithMember[] = [];
      for (const o of obj) {
        const finObj: AwardParticipantWithMember = <any>await firstValueFrom(this.afs.collection(COL.MEMBER).doc(o.uid).valueChanges());
        finObj.comment = o.comment;
        finObj.participatedOn = o.createdOn;
        out.push(finObj);
      }

      return out;
    }));
  }

  public create(req: WenRequest): Observable<Award|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.cAward);
    const data$ = callable(req);
    return data$;
  }

  public participate(req: WenRequest): Observable<Award|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.participateAward);
    const data$ = callable(req);
    return data$;
  }

  public approve(req: WenRequest): Observable<Award|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.aAward);
    const data$ = callable(req);
    return data$;
  }
}
