import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Award } from "functions/interfaces/models";
import { map, Observable, of } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress, SUB_COL, Timestamp, WenRequest } from '../../../functions/interfaces/models/base';
import { AwardParticipant } from './../../../functions/interfaces/models/award';
import { Member } from './../../../functions/interfaces/models/member';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

export interface AwardParticipantWithMember extends Member {
  comment?: string;
  participatedOn: Timestamp;
  completed: boolean;
}

export enum AwardFilter {
  ALL = 'all',
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  REJECTED = 'rejected'
}

@Injectable({
  providedIn: 'root',
})
export class AwardApi extends BaseApi<Award> {
  public collection = COL.AWARD;
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }

  public listen(id: EthAddress): Observable<Award | undefined> {
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
          fResult = fResult.where('endDate', '>=', new Date()).where('completed', '==', false).where('approved', '==', true);
        } else if (filter === AwardFilter.COMPLETED) {
          // todo .where('endDate', '>=', new Date())
          fResult = fResult.where('completed', '==', true).where('approved', '==', true);
        } else if (filter === AwardFilter.DRAFT) {
          fResult = fResult.where('endDate', '>=', new Date()).where('rejected', '==', false).where('approved', '==', false);
        } else if (filter === AwardFilter.REJECTED) {
          fResult = fResult.where('rejected', '==', true)
        }

        return fResult;
      }
    ).valueChanges();
  }

  public listenOwners(award: string, lastValue?: number): Observable<Member[]> {
    return this.subCollectionMembers(award, SUB_COL.OWNERS, lastValue);
  }

  public lastActive(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Award[]> {
    return this._query(this.collection, 'endDate', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('endDate', '>=', new Date()).where('completed', '==', false).where('approved', '==', true);
    });
  }

  public topActive(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Award[]> {
    return this._query(this.collection, 'endDate', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('endDate', '>=', new Date()).where('completed', '==', false).where('approved', '==', true);
    });
  }

  public lastCompleted(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Award[]> {
    return this._query(this.collection, 'createdOn', 'asc', lastValue, search, def, (ref: any) => {
      return ref.where('completed', '==', true).where('approved', '==', true);
    });
  }

  public topCompleted(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<Award[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('completed', '==', true).where('approved', '==', true);
    });
  }

  // TODO: Fix typings.
  public listenPendingParticipants<AwardParticipantWithMember>(award: string, lastValue?: number, searchIds?: string[]): Observable<any> {
    return this.subCollectionMembers<AwardParticipantWithMember>(award, SUB_COL.PARTICIPANTS, lastValue, searchIds, (original, finObj) => {
      finObj.comment = original.comment;
      finObj.participatedOn = original.createdOn;
      finObj.completed = original.completed;
      return finObj;
    }, 'createdOn', 'desc', DEFAULT_LIST_SIZE, (ref: any) => {
      return ref.where('completed', '==', false);
    });
  }

  // TODO: Fix typings.
  public listenIssuedParticipants<AwardParticipantWithMember>(award: string, lastValue?: number, searchIds?: string[]): Observable<any> {
    return this.subCollectionMembers<AwardParticipantWithMember>(award, SUB_COL.PARTICIPANTS, lastValue, searchIds, (original, finObj) => {
      finObj.comment = original.comment;
      finObj.participatedOn = original.createdOn;
      finObj.completed = original.completed;
      return finObj;
    }, 'createdOn', 'desc', DEFAULT_LIST_SIZE, (ref: any) => {
      return ref.where('completed', '==', true);
    });
  }

  public isMemberParticipant(awardId: string, memberId: string): Observable<boolean> {
    if (!awardId || !memberId) {
      return of(false);
    }

    return this.afs.collection(this.collection).doc(awardId.toLowerCase()).collection(SUB_COL.PARTICIPANTS).doc<AwardParticipant>(memberId.toLowerCase()).valueChanges().pipe(
      map((o) => {
        return !!o;
      })
    );
  }

  public create(req: WenRequest): Observable<Award | undefined> {
    return this.request(WEN_FUNC.cAward, req);
  }

  public participate(req: WenRequest): Observable<Award | undefined> {
    return this.request(WEN_FUNC.participateAward, req);
  }

  public approveParticipant(req: WenRequest): Observable<Award | undefined> {
    return this.request(WEN_FUNC.aParticipantAward, req);
  }

  public approve(req: WenRequest): Observable<Award | undefined> {
    return this.request(WEN_FUNC.aAward, req);
  }

  public reject(req: WenRequest): Observable<Award | undefined> {
    return this.request(WEN_FUNC.rAward, req);
  }
}
