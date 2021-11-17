import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Proposal } from "functions/interfaces/models";
import { Observable } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress, WenRequest } from '../../../functions/interfaces/models/base';
import { BaseApi } from './base.api';

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

  public listenForSpace(space: string): Observable<Proposal[]> {
    return this.afs.collection<Proposal>(
      this.collection,
      // We limit this to last record only. CreatedOn is always defined part of every record.
      (ref) => {
        return ref.where('space', '==', space)
      }
    ).valueChanges();
  }


  /**
   * Function to create profile if it does not exists yet.
   */
  public create(req: WenRequest): Observable<Proposal|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.cProposal);
    const data$ = callable(req);
    return data$;
  }
}
