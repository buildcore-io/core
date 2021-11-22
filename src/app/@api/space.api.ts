import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Space, SpaceGuardian } from "functions/interfaces/models";
import { SpaceMember } from 'functions/interfaces/models/space';
import { firstValueFrom, map, Observable, switchMap } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress, SUB_COL, WenRequest } from '../../../functions/interfaces/models/base';
import { Member } from './../../../functions/interfaces/models/member';
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

  public listenGuardians(spaceId: string): Observable<Member[]> {
    return (<Observable<SpaceGuardian[]>>this.afs.collection(this.collection)
    .doc(spaceId.toLowerCase()).collection(SUB_COL.GUARDIANS).valueChanges()).pipe(switchMap(async (obj: SpaceGuardian[]) => {
      const out: Member[] = [];
      for (const o of obj) {
        out.push(<any>await firstValueFrom(this.afs.collection(COL.MEMBER).doc(o.uid).valueChanges()));
      }

      return out;
    }));
  }

  public listenMembers(spaceId: string): Observable<Member[]> {
    return (<Observable<SpaceMember[]>>this.afs.collection(this.collection)
    .doc(spaceId.toLowerCase()).collection(SUB_COL.MEMBERS).valueChanges()).pipe(switchMap(async (obj: SpaceMember[]) => {
      const out: Member[] = [];
      for (const o of obj) {
        out.push(<any>await firstValueFrom(this.afs.collection(COL.MEMBER).doc(o.uid).valueChanges()));
      }

      return out;
    }));
  }

  public create(req: WenRequest): Observable<Space|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.cSpace);
    const data$ = callable(req);
    return data$;
  }

  public save(req: WenRequest): Observable<Space|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.uSpace);
    const data$ = callable(req);
    return data$;
  }

  public join(req: WenRequest): Observable<Space|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.joinSpace);
    const data$ = callable(req);
    return data$;
  }

  public leave(req: WenRequest): Observable<Space|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.leaveSpace);
    const data$ = callable(req);
    return data$;
  }

   public setGuardian(req: WenRequest): Observable<Space|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.addGuardianSpace);
    const data$ = callable(req);
    return data$;
  }

  public removeGuardian(req: WenRequest): Observable<Space|undefined> {
    const callable = this.fns.httpsCallable(WEN_FUNC.removeGuardianSpace);
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
