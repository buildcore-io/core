import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Observable } from 'rxjs';
import { EthAddress } from './../../../lib/interfaces/base';
import { Member } from './../../../lib/interfaces/member';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class MemberApi extends BaseApi<Member> {
  public collection = 'member';
  constructor(protected afs: AngularFirestore, private fns: AngularFireFunctions) {
    super(afs);
  }

  public get(id: EthAddress): Observable<Member|undefined> {
    return super.get(id);
  }

  /**
   * Function to create profile if it does not exists yet.
   */
  public create(id: EthAddress): Observable<Member|undefined> {
    const callable = this.fns.httpsCallable('createMember');
    const data$ = callable({ address: id });
    return data$;
  }
}
