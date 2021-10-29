import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Observable } from 'rxjs';
import { WEN_FUNCTIONS } from '../../../functions/interfaces/functions/index';
import { EthAddress } from '../../../functions/interfaces/models/base';
import { Member } from '../../../functions/interfaces/models/member';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class MemberApi extends BaseApi<Member> {
  public collection = 'member';
  constructor(protected afs: AngularFirestore, private fns: AngularFireFunctions) {
    super(afs);
  }

  public listen(id: EthAddress): Observable<Member|undefined> {
    return super.listen(id);
  }

  /**
   * Function to create profile if it does not exists yet.
   */
  public createIfNotExists(id: EthAddress): Observable<Member|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNCTIONS.CREATE_MEMBER_IF_NOT_EXISTS);
    const data$ = callable({ address: id });
    return data$;
  }

  /**
   * Function to update the member.
   */
  public updateMember(data: Member): Observable<Member|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNCTIONS.UPDATE_MEMBER_IF_NOT_EXISTS);
    const data$ = callable(data);
    return data$;
  }
}
