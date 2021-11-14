import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Space, SpaceGuardian } from "functions/interfaces/models";
import { map, Observable } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress, SUB_COL } from '../../../functions/interfaces/models/base';
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
    console.log(this.collection, spaceId, SUB_COL.MEMBERS, memberId);
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
  public createSpace(req: WenRequest): Observable<Space|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.cSpace);
    const data$ = callable(token);
    return data$;
  }

  /**
   * Function to update the space.
   */
  public updateSpace(req: WenRequest): Observable<Space|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.uSpace);
    const data$ = callable(token);
    return data$;
  }
}
