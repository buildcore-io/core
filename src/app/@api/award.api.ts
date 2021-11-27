import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Award } from "functions/interfaces/models";
import { Observable } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress, SUB_COL, Timestamp, WenRequest } from '../../../functions/interfaces/models/base';
import { Member } from './../../../functions/interfaces/models/member';
import { BaseApi } from './base.api';

export interface AwardParticipantWithMember extends Member {
  comment?: string;
  participatedOn: Timestamp;
  completed: boolean;
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
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }

  public listen(id: EthAddress): Observable<Award|undefined> {
    return super.listen(id);
  }

  // TODO implement pagination
  public listenSpace(space: string, filter: AwardFilter = AwardFilter.ALL): Observable<Award[]> {
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

  public listenOwners(award: string, lastValue?: any): Observable<Member[]> {
    return this.subCollectionMembers(award, SUB_COL.OWNERS, lastValue);
  }

  // TODO: Fix typings.
  public listenParticipants<AwardParticipantWithMember>(award: string, lastValue?: any): Observable<any> {
    return this.subCollectionMembers<AwardParticipantWithMember>(award, SUB_COL.PARTICIPANTS, lastValue, (original, finObj) => {
      finObj.comment = original.comment;
      finObj.participatedOn = original.createdOn;
      finObj.completed = original.completed;
      return finObj;
    });
  }

  public create(req: WenRequest): Observable<Award|undefined> {
    return this.request(WEN_FUNC.cAward, req);
  }

  public participate(req: WenRequest): Observable<Award|undefined> {
    return this.request(WEN_FUNC.participateAward, req);
  }

  public approve(req: WenRequest): Observable<Award|undefined> {
    return this.request(WEN_FUNC.aAward, req);
  }
}
