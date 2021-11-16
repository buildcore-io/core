import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Space, SpaceGuardian } from "functions/interfaces/models";
import { map, Observable } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress, SUB_COL, WenRequest } from '../../../functions/interfaces/models/base';
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

  public isMemberWithinSpace(spaceId: string, memberId: string): Observable<boolean> {
    return this.afs.collection(this.collection).doc(spaceId.toLowerCase()).collection(SUB_COL.MEMBERS).doc<SpaceGuardian>(memberId.toLowerCase()).valueChanges().pipe(
      map((o) => {
        return !!o;
      })
    );
  }

  public isGuardianWithinSpace(spaceId: string, memberId: string): Observable<boolean> {
    return this.afs.collection(this.collection).doc(spaceId.toLowerCase()).collection(SUB_COL.GUARDIANS).doc<SpaceGuardian>(memberId.toLowerCase()).valueChanges().pipe(
      map((o) => {
        return !!o;
      })
    );
  }

  /**
   * Function to create profile if it does not exists yet.
   */
  public create(req: WenRequest): Observable<Space|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.cSpace);
    const data$ = callable(req);
    return data$;
  }

  /**
   * Function to create profile if it does not exists yet.
   */
   public join(req: WenRequest): Observable<Space|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.joinSpace);
    const data$ = callable(req);
    return data$;
  }

  /**
   * Function to create profile if it does not exists yet.
   */
  public leave(req: WenRequest): Observable<Space|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.leaveSpace);
    const data$ = callable(req);
    return data$;
  }

  /**
   * Function to update the space.
   */
  public update(req: WenRequest): Observable<Space|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.uSpace);
    const data$ = callable(req);
    return data$;
  }
}
