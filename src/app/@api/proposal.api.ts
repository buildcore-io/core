import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Proposal } from "functions/interfaces/models";
import { map, Observable, of, switchMap } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress, SUB_COL, WenRequest } from '../../../functions/interfaces/models/base';
import { Timestamp } from './../../../functions/interfaces/models/base';
import { Member } from './../../../functions/interfaces/models/member';
import { ProposalMember } from './../../../functions/interfaces/models/proposal';
import { Transaction, TransactionType } from './../../../functions/interfaces/models/transaction';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

export enum ProposalFilter {
  ALL = 'all',
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  REJECTED = 'rejected'
}

export interface ProposalParticipantWithMember extends Member {
  voted?: boolean;
  weight?: number;
  values?: number[];

  // Only internal variable.
  _issuedOn?: Timestamp
}

export interface TransactionWithFullMember extends Transaction {
  memberRec: Member;
}

@Injectable({
  providedIn: 'root',
})
export class ProposalApi extends BaseApi<Proposal> {
  public collection = COL.PROPOSAL;
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }

  public listen(id: EthAddress): Observable<Proposal|undefined> {
    return super.listen(id);
  }

  // TODO implement pagination
  public listenSpace(space: string, filter: ProposalFilter = ProposalFilter.ALL): Observable<Proposal[]> {
    return this.afs.collection<Proposal>(
      this.collection,
      // We limit this to last record only. CreatedOn is always defined part of every record.
      (ref) => {
        let fResult: any = ref.where('space', '==', space);
        if (filter === ProposalFilter.ACTIVE) {
          fResult = fResult.where('settings.endDate', '>=', new Date()).where('approved', '==', true);
        } else if (filter === ProposalFilter.COMPLETED) {
          fResult = fResult.where('settings.endDate', '<=', new Date()).where('approved', '==', true);
        } else if (filter === ProposalFilter.DRAFT) {
          fResult = fResult.where('rejected', '==', false).where('approved', '==', false);
        } else if (filter === ProposalFilter.REJECTED) {
          fResult = fResult.where('rejected', '==', true)
        }

        return fResult;
      }
    ).valueChanges();
  }

  public lastVotes(proposalId: string): Observable<TransactionWithFullMember[]> {
    return this.afs.collection<Transaction>(
      COL.TRANSACTION,
      // We limit this to last record only. CreatedOn is always defined part of every record.
      (ref) => {
        return ref.where('payload.proposalId', '==', proposalId).where('type', '==', TransactionType.VOTE).limit(DEFAULT_LIST_SIZE)
      }
    ).valueChanges().pipe(switchMap(async (obj: any[]) => {
      const out: TransactionWithFullMember[] = [];
      const subRecords: Transaction[] = await this.getSubRecordsInBatches(COL.MEMBER, obj.map((o) => {
        return o.member;
      }));

      for (const o of obj) {
        const finObj: any = subRecords.find((subO: any) => {
          return subO.uid === o.member;
        });

        out.push({
          ...o,
          ...{
            memberRec: finObj
          }
        });
      }

      return out;
    }));
  }

  public getMembersVotes(proposalId: string, memberId: string): Observable<Transaction[]> {
    return this.afs.collection<Transaction>(
      COL.TRANSACTION,
      // We limit this to last record only. CreatedOn is always defined part of every record.
      (ref) => {
        return ref.where('payload.proposalId', '==', proposalId)
                  .where('member', '==', memberId)
                  .where('type', '==', TransactionType.VOTE).orderBy('createdOn', 'desc').limit(DEFAULT_LIST_SIZE)
      }
    ).valueChanges();
  }

  public canMemberVote(proposalId: string, memberId: string): Observable<boolean> {
    if (!proposalId || !memberId) {
      return of(false);
    }

    return this.afs.collection(this.collection).doc(proposalId.toLowerCase()).collection(SUB_COL.MEMBERS).doc<ProposalMember>(memberId.toLowerCase()).valueChanges().pipe(
      map((o) => {
        return !!o;
      })
    );
  }

  public listenPendingMembers(proposalId: string, lastValue?: any, searchIds?: string[], orderBy: string|string[] = 'createdOn', direction: any = 'desc', def = DEFAULT_LIST_SIZE): Observable<ProposalParticipantWithMember[]> {
    return this.subCollectionMembers(proposalId, SUB_COL.MEMBERS, lastValue, searchIds, (original, finObj) => {
      finObj.voted = original.voted;
      finObj._issuedOn = original.createdOn;
      finObj.weight = original.weight;
      return finObj;
    }, orderBy, direction, def, (ref: any) => {
      return ref.where('voted', '==', false);
    });
  }

  public listenVotedMembers(proposalId: string, lastValue?: any, searchIds?: string[], orderBy: string|string[] = 'createdOn', direction: any = 'desc', def = DEFAULT_LIST_SIZE): Observable<ProposalParticipantWithMember[]> {
    return this.subCollectionMembers(proposalId, SUB_COL.MEMBERS, lastValue, searchIds, (original, finObj) => {
      finObj.voted = original.voted;
      finObj._issuedOn = original.createdOn;
      finObj.weight = original.weight;
      return finObj;
    }, orderBy, direction, def, (ref: any) => {
      return ref.where('voted', '==', true);
    });
  }

  public create(req: WenRequest): Observable<Proposal|undefined> {
    return this.request(WEN_FUNC.cProposal, req);
  }

  public approve(req: WenRequest): Observable<Proposal|undefined> {
    return this.request(WEN_FUNC.aProposal, req);
  }

  public reject(req: WenRequest): Observable<Proposal|undefined> {
    return this.request(WEN_FUNC.rProposal, req);
  }

  public vote(req: WenRequest): Observable<Proposal|undefined> {
    return this.request(WEN_FUNC.voteOnProposal, req);
  }
}
