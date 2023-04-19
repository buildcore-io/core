import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  collection,
  collectionData,
  doc,
  docData,
  Firestore,
  query,
  where,
} from '@angular/fire/firestore';
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

  constructor(protected firestore: Firestore, protected httpClient: HttpClient) {
    super(firestore, httpClient);
  }

  public listen(id: EthAddress): Observable<Award | undefined> {
    return super.listen(id);
  }

  // TODO implement pagination
  public listenSpace(space: string, filter: AwardFilter = AwardFilter.ALL): Observable<Award[]> {
    const constraints = [];
    constraints.push(where('space', '==', space));
    if (filter === AwardFilter.ACTIVE) {
      constraints.push(where('endDate', '>=', new Date()));
      constraints.push(where('completed', '==', false));
      constraints.push(where('approved', '==', true));
    } else if (filter === AwardFilter.COMPLETED) {
      constraints.push(where('completed', '==', true));
      constraints.push(where('approved', '==', true));
    } else if (filter === AwardFilter.DRAFT) {
      constraints.push(where('endDate', '>=', new Date()));
      constraints.push(where('rejected', '==', false));
      constraints.push(where('approved', '==', false));
    } else if (filter === AwardFilter.REJECTED) {
      constraints.push(where('rejected', '==', true));
    }

    return collectionData(
      query(collection(this.firestore, this.collection), ...constraints),
    ) as Observable<Award[]>;
  }

  public listenOwners(award: string, lastValue?: number): Observable<Member[]> {
    return this.subCollectionMembers({
      docId: award,
      subCol: SUB_COL.OWNERS,
      lastValue: lastValue,
    });
  }

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
