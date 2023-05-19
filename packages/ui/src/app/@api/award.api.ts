import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { doc, docData, Firestore, where } from '@angular/fire/firestore';
import {
  Award,
  COL,
  EthAddress,
  Member,
  SUB_COL,
  Timestamp,
  WEN_FUNC,
  WenRequest,
} from '@soonaverse/interfaces';
import { AwardRepository, SoonEnv } from '@soonaverse/lib';

import { environment } from '@env/environment';
import { map, Observable, of } from 'rxjs';
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
  REJECTED = 'rejected',
}

@Injectable({
  providedIn: 'root',
})
export class AwardApi extends BaseApi<Award> {
  public collection = COL.AWARD;
  protected awardRepo: AwardRepository = new AwardRepository(
    environment.production ? SoonEnv.PROD : SoonEnv.TEST,
  );

  constructor(protected firestore: Firestore, protected httpClient: HttpClient) {
    super(firestore, httpClient);
  }

  public listen(id: EthAddress): Observable<Award | undefined> {
    return super.listen(id);
  }

  // TODO implement pagination
  // AwardRepository.getBySpaceAndFilterLive
  public listenSpace(space: string, filter: AwardFilter = AwardFilter.ALL): Observable<Award[]> {
    return this.awardRepo.getBySpaceAndFilterLive(space, filter);
  }

  // AwardRepository.getByFieldLive
  public listenOwners(award: string, lastValue?: number): Observable<Member[]> {
    return this.subCollectionMembers({
      docId: award,
      subCol: SUB_COL.OWNERS,
      lastValue: lastValue,
    });
  }

  // AwardRepository.getLastActiveLive
  public lastActive(lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<Award[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'endDate',
      direction: 'asc',
      lastValue: lastValue,
      def: def,
      constraints: [
        where('endDate', '>=', new Date()),
        where('completed', '==', false),
        where('approved', '==', true),
      ],
    });
  }

  // TODO: Fix typings.
  // AwardParticipantRepository.getParticipantsLive
  public listenPendingParticipants<AwardParticipantWithMember>(
    award: string,
    lastValue?: number,
    searchIds?: string[],
  ): Observable<any> {
    return this.subCollectionMembers<AwardParticipantWithMember>({
      docId: award,
      subCol: SUB_COL.PARTICIPANTS,
      lastValue: lastValue,
      searchIds: searchIds,
      manipulateOutput: (original, finObj) => {
        finObj.comment = original.comment;
        finObj.participatedOn = original.createdOn;
        finObj.completed = original.completed;
        return finObj;
      },
      orderBy: 'createdOn',
      direction: 'desc',
      def: DEFAULT_LIST_SIZE,
      constraints: [where('completed', '==', false)],
    });
  }

  // TODO: Fix typings.
  // AwardParticipantRepository.getParticipantsLive
  public listenIssuedParticipants<AwardParticipantWithMember>(
    award: string,
    lastValue?: number,
    searchIds?: string[],
  ): Observable<any> {
    return this.subCollectionMembers<AwardParticipantWithMember>({
      docId: award,
      subCol: SUB_COL.PARTICIPANTS,
      lastValue: lastValue,
      searchIds: searchIds,
      manipulateOutput: (original, finObj) => {
        finObj.comment = original.comment;
        finObj.participatedOn = original.createdOn;
        finObj.completed = original.completed;
        return finObj;
      },
      orderBy: 'createdOn',
      direction: 'desc',
      def: DEFAULT_LIST_SIZE,
      constraints: [where('completed', '==', true)],
    });
  }

  // AwardParticipantRepository.getByIdLive
  public isMemberParticipant(awardId: string, memberId: string): Observable<boolean> {
    if (!awardId || !memberId) {
      return of(false);
    }

    return docData(
      doc(
        this.firestore,
        this.collection,
        awardId.toLowerCase(),
        SUB_COL.PARTICIPANTS,
        memberId.toLowerCase(),
      ),
    ).pipe(
      map((o) => {
        return !!o;
      }),
    );
  }

  public create(req: WenRequest): Observable<Award | undefined> {
    return this.request(WEN_FUNC.createAward, req);
  }

  public participate(req: WenRequest): Observable<Award | undefined> {
    return this.request(WEN_FUNC.participateAward, req);
  }

  public approveParticipant(req: WenRequest): Observable<Award | undefined> {
    return this.request(WEN_FUNC.approveParticipantAward, req);
  }

  public approve(req: WenRequest): Observable<Award | undefined> {
    return this.request(WEN_FUNC.fundAward, req);
  }

  public reject(req: WenRequest): Observable<Award | undefined> {
    return this.request(WEN_FUNC.rejectAward, req);
  }

  public fundAndMint(req: WenRequest): Observable<Award | undefined> {
    return this.request(WEN_FUNC.fundAward, req);
  }
}
