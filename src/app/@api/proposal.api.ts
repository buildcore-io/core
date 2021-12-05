import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Proposal } from "functions/interfaces/models";
import { map, Observable, of } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress, SUB_COL, WenRequest } from '../../../functions/interfaces/models/base';
import { Member } from './../../../functions/interfaces/models/member';
import { ProposalMember } from './../../../functions/interfaces/models/proposal';
import { Transaction, TransactionType } from './../../../functions/interfaces/models/transaction';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

export enum ProposalFilter {
  ALL,
  ACTIVE,
  COMPLETED
}

export interface ProposalParticipantWithMember extends Member {
  voted?: boolean;
  weight?: number;
  values?: number[];
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
          fResult = fResult.where('settings.endDate', '>=', new Date());
        } else if (filter === ProposalFilter.COMPLETED) {
          fResult = fResult.where('settings.endDate', '<=', new Date());
        }

        return fResult;
      }
    ).valueChanges();
  }

  public lastVotes(proposalId: string): Observable<Transaction[]> {
    return this.afs.collection<Transaction>(
      COL.TRANSACTION,
      // We limit this to last record only. CreatedOn is always defined part of every record.
      (ref) => {
        return ref.where('payload.proposalId', '==', proposalId).where('type', '==', TransactionType.VOTE).limit(DEFAULT_LIST_SIZE)
      }
    ).valueChanges();
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

  public listenMembers(proposalId: string, lastValue?: any, orderBy: string|string[] = 'createdOn', direction: any = 'desc', def = DEFAULT_LIST_SIZE): Observable<ProposalParticipantWithMember[]> {
    return this.subCollectionMembers(proposalId, SUB_COL.MEMBERS, lastValue, (original, finObj) => {
      finObj.voted = original.voted;
      finObj.weight = original.weight;
      return finObj;
    }, orderBy, direction, def);
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
