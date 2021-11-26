import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollectionGroup } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Award } from 'functions/interfaces/models';
import { firstValueFrom, Observable, switchMap } from "rxjs";
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress, SUB_COL, WenRequest } from '../../../functions/interfaces/models/base';
import { AwardParticipant } from './../../../functions/interfaces/models/award';
import { Member } from './../../../functions/interfaces/models/member';
import { Space, SpaceGuardian, SpaceMember } from './../../../functions/interfaces/models/space';
import { Transaction, TransactionType } from './../../../functions/interfaces/models/transaction';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class MemberApi extends BaseApi<Member> {
  public collection = 'member';
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }

  public listen(id: EthAddress): Observable<Member|undefined> {
    return super.listen(id);
  }

  public topSpaces(memberId: EthAddress, orderBy: string|string[] = 'createdOn', lastValue?: any, def = DEFAULT_LIST_SIZE): Observable<Space[]> {
    const ref: AngularFirestoreCollectionGroup<SpaceMember> = this.afs.collectionGroup<SpaceMember>(
      SUB_COL.MEMBERS,
      (ref: any) => {
        const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];
        let query: any = ref.where('uid', '==', memberId).where('parentCol', '==',  COL.SPACE);
        order.forEach((o) => {
          query = query.orderBy(o, 'desc');
        });

        if (lastValue) {
          query = query.startAfter(lastValue).limit(def);
        } else {
          query = query.limit(def);
        }

        return query;
      }
    );
    return ref.valueChanges().pipe(switchMap(async (obj: SpaceMember[]) => {
      const out: Space[] = [];
      for (const o of obj) {
        out.push(<any>await firstValueFrom(this.afs.collection(COL.SPACE).doc(o.parentId).valueChanges()));
      }

      return out;
    }));
  }

  public topAwards(memberId: EthAddress, orderBy: string|string[] = 'createdOn', lastValue?: any, def = DEFAULT_LIST_SIZE): Observable<Award[]> {
    const ref: AngularFirestoreCollectionGroup<AwardParticipant> = this.afs.collectionGroup<AwardParticipant>(
      SUB_COL.PARTICIPANTS,
      (ref: any) => {
        const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];
        let query: any = ref.where('uid', '==', memberId).where('parentCol', '==',  COL.AWARD);
        order.forEach((o) => {
          query = query.orderBy(o, 'desc');
        });

        if (lastValue) {
          query = query.startAfter(lastValue).limit(def);
        } else {
          query = query.limit(def);
        }

        return query;
      }
    );
    return ref.valueChanges().pipe(switchMap(async (obj: AwardParticipant[]) => {
      const out: Award[] = [];
      for (const o of obj) {
        out.push(<any>await firstValueFrom(this.afs.collection(COL.AWARD).doc(o.parentId).valueChanges()));
      }

      return out;
    }));
  }

  public topBadges(memberId: string, orderBy: string|string[] = 'createdOn', lastValue?: any, def = DEFAULT_LIST_SIZE): Observable<Transaction[]> {
    return this.afs.collection<Transaction>(
      COL.TRANSACTION,
      (ref) => {
        const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];
        let query: any = ref.where('member', '==', memberId).where('type', '==', TransactionType.BADGE);
        order.forEach((o) => {
          query = query.orderBy(o, 'desc');
        });

        if (lastValue) {
          query = query.startAfter(lastValue).limit(def);
        } else {
          query = query.limit(def);
        }

        return query;
      }
    ).valueChanges();
  }

  public allSpacesAsMember(memberId: EthAddress): Observable<Space[]> {
    const ref: AngularFirestoreCollectionGroup<SpaceMember> = this.afs.collectionGroup<SpaceMember>(
      SUB_COL.MEMBERS,
      (ref: any) => {
        return ref.where('uid', '==', memberId).where('parentCol', '==',  COL.SPACE);
      }
    );
    return ref.valueChanges().pipe(switchMap(async (obj: SpaceMember[]) => {
      const out: Space[] = [];
      for (const o of obj) {
        out.push(<any>await firstValueFrom(this.afs.collection(COL.SPACE).doc(o.parentId).valueChanges()));
      }

      return out;
    }));
  }

  public allSpacesAsGuardian(memberId: EthAddress): Observable<Space[]> {
    const ref: AngularFirestoreCollectionGroup<SpaceGuardian> = this.afs.collectionGroup<SpaceGuardian>(
      SUB_COL.GUARDIANS,
      (ref: any) => {
        return ref.where('uid', '==', memberId).where('parentCol', '==',  COL.SPACE);
      }
    );
    return ref.valueChanges().pipe(switchMap(async (obj: SpaceGuardian[]) => {
      const out: Space[] = [];
      for (const o of obj) {
        out.push(<any>await firstValueFrom(this.afs.collection(COL.SPACE).doc(o.parentId).valueChanges()));
      }

      return out;
    }));
  }

  public createIfNotExists(address: string): Observable<Member|undefined> {
    return this.request(WEN_FUNC.cMemberNotExists, address);
  }

  public updateMember(req: WenRequest): Observable<Member|undefined> {
    return this.request(WEN_FUNC.uMember, req);
  }
}
