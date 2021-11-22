import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Proposal } from "functions/interfaces/models";
import { Observable } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress, SUB_COL, WenRequest } from '../../../functions/interfaces/models/base';
import { ProposalMember } from './../../../functions/interfaces/models/proposal';
import { Transaction, TransactionType } from './../../../functions/interfaces/models/transaction';
import { BaseApi } from './base.api';

export enum ProposalFilter {
  ALL,
  ACTIVE,
  COMPLETED
}

@Injectable({
  providedIn: 'root',
})
export class ProposalApi extends BaseApi<Proposal> {
  public collection = COL.PROPOSAL;
  constructor(protected afs: AngularFirestore, private fns: AngularFireFunctions) {
    super(afs);
  }

  public listen(id: EthAddress): Observable<Proposal|undefined> {
    return super.listen(id);
  }

  public listenForSpace(space: string, filter: ProposalFilter = ProposalFilter.ALL): Observable<Proposal[]> {
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

  public listenMembers(proposalId: string): Observable<ProposalMember[]> {
    return <Observable<ProposalMember[]>>this.afs.collection(this.collection)
          .doc(proposalId.toLowerCase()).collection(SUB_COL.MEMBERS).valueChanges();
  }

  public lastVotes(proposalId: string): Observable<Transaction[]> {
    return this.afs.collection<Transaction>(
      COL.TRANSACTION,
      // We limit this to last record only. CreatedOn is always defined part of every record.
      (ref) => {
        return ref.where('payload.proposalId', '==', proposalId).where('type', '==', TransactionType.VOTE)
      }
    ).valueChanges();
  }

  public create(req: WenRequest): Observable<Proposal|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.cProposal);
    const data$ = callable(req);
    return data$;
  }

  public approve(req: WenRequest): Observable<Proposal|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.aProposal);
    const data$ = callable(req);
    return data$;
  }

  public reject(req: WenRequest): Observable<Proposal|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.rProposal);
    const data$ = callable(req);
    return data$;
  }

  public vote(req: WenRequest): Observable<Proposal|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.voteOnProposal);
    const data$ = callable(req);
    return data$;
  }
}
