import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Award } from "functions/interfaces/models";
import { firstValueFrom, map, Observable, of, switchMap } from 'rxjs';
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
  public listenPendingParticipants<AwardParticipantWithMember>(award: string, lastValue?: any): Observable<any> {
    return this.subCollectionParticipants<AwardParticipantWithMember>(award, SUB_COL.PARTICIPANTS, lastValue, (original, finObj) => {
      finObj.comment = original.comment;
      finObj.participatedOn = original.createdOn;
      finObj.completed = original.completed;
      return finObj;
    }, false);
  }

  // TODO: Fix typings.
  public listenIssuedParticipants<AwardParticipantWithMember>(award: string, lastValue?: any): Observable<any> {
    return this.subCollectionParticipants<AwardParticipantWithMember>(award, SUB_COL.PARTICIPANTS, lastValue, (original, finObj) => {
      finObj.comment = original.comment;
      finObj.participatedOn = original.createdOn;
      finObj.completed = original.completed;
      return finObj;
    }, true);
  }

  public subCollectionParticipants<T>(
    docId: string,
    subCol: SUB_COL,
    lastValue?: any,
    manipulateOutput?: (original: any, finObj: any) => any,
    completed = true
  ): Observable<T[]> {
    // TODO Temporary clean up once merged into base.ts
    const orderBy: string|string[] = 'createdOn';
    const direction: any = 'desc';
    const def = DEFAULT_LIST_SIZE;
    // ---

    const ref: any = this.afs.collection(this.collection).doc(docId.toLowerCase()).collection(subCol, (subRef) => {
      // TODO consolidate below withsubCollection Members below line is only custom one.
      let query: any = subRef.where('completed', '==', completed);
      // --
      const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];
      order.forEach((o) => {
        query = query.orderBy(o, direction);
      });
      if (lastValue) {
        query = query.startAfter(lastValue).limit(def);
      } else {
        query = query.limit(def);
      }

      return query;
    });

    return ref.valueChanges().pipe(switchMap(async (obj: any[]) => {
      // console.log(this.collection, subCol, lastValue, obj);
      const out: T[] = [];
      for (const o of obj) {
        const finObj: any = <any>await firstValueFrom(this.afs.collection(COL.MEMBER).doc(o.uid).valueChanges());
        if (manipulateOutput) {
          out.push(manipulateOutput(o, finObj));
        } else {
          out.push(finObj);
        }
      }

      return out;
    }));
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
