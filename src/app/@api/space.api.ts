import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Space } from "functions/interfaces/models";
import { Observable } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress } from '../../../functions/interfaces/models/base';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class SpaceApi extends BaseApi<Space> {
  public collection = COL.SPACE;
  constructor(protected afs: AngularFirestore, private fns: AngularFireFunctions) {
    super(afs);
  }

  public listen(id: EthAddress): Observable<Space|undefined> {
    return super.listen(id);
  }

  /**
   * Function to create profile if it does not exists yet.
   */
  public createSpace(token: string): Observable<Space|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.cSpace);
    const data$ = callable(token);
    return data$;
  }

  /**
   * Function to update the space.
   */
  public updateSpace(token: string): Observable<Space|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.uSpace);
    const data$ = callable(token);
    return data$;
  }
}
