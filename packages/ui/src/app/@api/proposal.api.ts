import { Injectable } from '@angular/core';
import {
  collection,
  collectionData,
  doc,
  docData,
  Firestore,
  limit,
  orderBy,
  query,
  QueryConstraint,
  where,
} from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import {
  COL,
  EthAddress,
  Member,
  Proposal,
  SUB_COL,
  Timestamp,
  Transaction,
  TransactionType,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import { map, Observable, of, switchMap } from 'rxjs';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

export enum ProposalFilter {
  ALL = 'all',
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

export interface ProposalParticipantWithMember extends Member {
  voted?: boolean;
  weight?: number;
  values?: number[];

  // Only internal variable.
  _issuedOn?: Timestamp;
}

export interface TransactionWithFullMember extends Transaction {
  memberRec?: Member;
}

@Injectable({
  providedIn: 'root',
})
export class ProposalApi extends BaseApi<Proposal> {
  public collection = COL.PROPOSAL;

  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
  }

  public listen(id: EthAddress): Observable<Proposal | undefined> {
    return super.listen(id);
  }

  public lastActive(lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<Proposal[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'settings.endDate',
      direction: 'asc',
      lastValue: lastValue,
      def: def,
      constraints: [where('settings.endDate', '>=', new Date()), where('approved', '==', true)],
    });
  }

  // TODO implement pagination
  public listenSpace(
    space: string,
    filter: ProposalFilter = ProposalFilter.ALL,
  ): Observable<Proposal[]> {
    const constraints: QueryConstraint[] = [where('space', '==', space)];
    if (filter === ProposalFilter.ACTIVE) {
      constraints.push(where('settings.endDate', '>=', new Date()));
      constraints.push(where('approved', '==', true));
    } else if (filter === ProposalFilter.COMPLETED) {
      constraints.push(where('settings.endDate', '<=', new Date()));
      constraints.push(where('approved', '==', true));
    } else if (filter === ProposalFilter.DRAFT) {
      constraints.push(where('rejected', '==', false));
      constraints.push(where('approved', '==', false));
    } else if (filter === ProposalFilter.REJECTED) {
      constraints.push(where('rejected', '==', true));
    }

    return collectionData(
      query(collection(this.firestore, this.collection), ...constraints),
    ) as Observable<Proposal[]>;
  }

  public lastVotes(proposalId: string): Observable<TransactionWithFullMember[]> {
    return collectionData(
      query(
        collection(this.firestore, COL.TRANSACTION),
        where('payload.proposalId', '==', proposalId),
        where('type', '==', TransactionType.VOTE),
        orderBy('createdOn', 'desc'),
        limit(DEFAULT_LIST_SIZE),
      ),
    ).pipe(
      switchMap(async (obj: any[]) => {
        const out: TransactionWithFullMember[] = [];
        const subRecords: Member[] = await this.getSubRecordsInBatches(
          COL.MEMBER,
          obj.map((o) => {
            return o.member;
          }),
        );

        for (const o of obj) {
          const finObj: any = subRecords.find((subO: any) => {
            return subO.uid === o.member;
          });

          out.push({
            ...o,
            ...{
              memberRec: finObj,
            },
          });
        }

        return out;
      }),
    );
  }

  public getMembersVotes(proposalId: string, memberId: string): Observable<Transaction[]> {
    return collectionData(
      query(
        collection(this.firestore, COL.TRANSACTION),
        where('payload.proposalId', '==', proposalId),
        where('member', '==', memberId),
        where('type', '==', TransactionType.VOTE),
        orderBy('createdOn', 'desc'),
        limit(DEFAULT_LIST_SIZE),
      ),
    ) as Observable<Transaction[]>;
  }

  public canMemberVote(proposalId: string, memberId: string): Observable<boolean> {
    if (!proposalId || !memberId) {
      return of(false);
    }

    return docData(
      doc(
        this.firestore,
        this.collection,
        proposalId.toLowerCase(),
        SUB_COL.MEMBERS,
        memberId.toLowerCase(),
      ),
    ).pipe(
      map((o) => {
        return !!o;
      }),
    );
  }

  public listenPendingMembers(
    proposalId: string,
    lastValue?: number,
    searchIds?: string[],
    orderBy: string | string[] = 'createdOn',
    direction: any = 'desc',
    def = DEFAULT_LIST_SIZE,
  ): Observable<ProposalParticipantWithMember[]> {
    return this.subCollectionMembers({
      docId: proposalId,
      subCol: SUB_COL.MEMBERS,
      lastValue: lastValue,
      searchIds: searchIds,
      manipulateOutput: (original, finObj) => {
        finObj.voted = original.voted;
        finObj._issuedOn = original.createdOn;
        finObj.weight = original.weight;
        return finObj;
      },
      orderBy: orderBy,
      direction: direction,
      def: def,
      constraints: [where('voted', '==', false)],
    });
  }

  public listenVotedMembers(
    proposalId: string,
    lastValue?: number,
    searchIds?: string[],
    orderBy: string | string[] = 'createdOn',
    direction: any = 'desc',
    def = DEFAULT_LIST_SIZE,
  ): Observable<ProposalParticipantWithMember[]> {
    return this.subCollectionMembers({
      docId: proposalId,
      subCol: SUB_COL.MEMBERS,
      lastValue: lastValue,
      searchIds: searchIds,
      manipulateOutput: (original, finObj) => {
        finObj.voted = original.voted;
        finObj._issuedOn = original.createdOn;
        finObj.weight = original.weight;
        return finObj;
      },
      orderBy: orderBy,
      direction: direction,
      def: def,
      constraints: [where('voted', '==', true)],
    });
  }

  public create(req: WenRequest): Observable<Proposal | undefined> {
    return this.request(WEN_FUNC.cProposal, req);
  }

  public approve(req: WenRequest): Observable<Proposal | undefined> {
    return this.request(WEN_FUNC.aProposal, req);
  }

  public reject(req: WenRequest): Observable<Proposal | undefined> {
    return this.request(WEN_FUNC.rProposal, req);
  }

  public vote(req: WenRequest): Observable<Proposal | undefined> {
    return this.request(WEN_FUNC.voteOnProposal, req);
  }
}
