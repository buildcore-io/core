import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollectionGroup } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import * as dayjs from 'dayjs';
import { Award } from 'functions/interfaces/models';
import { firstValueFrom, Observable, switchMap } from "rxjs";
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { COL, EthAddress, SUB_COL, WenRequest } from '../../../functions/interfaces/models/base';
import { Member } from './../../../functions/interfaces/models/member';
import { Proposal } from './../../../functions/interfaces/models/proposal';
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
    return this.topParent(COL.SPACE, SUB_COL.MEMBERS, memberId, orderBy, lastValue, def);
  }

  // TODO We need to tweak this to make sure don't filter locally.
  public topAwards(memberId: EthAddress, orderBy: string|string[] = 'createdOn', lastValue?: any, def = 1000): Observable<Award[]> {
    return this.topParent(COL.AWARD, SUB_COL.PARTICIPANTS, memberId, orderBy, lastValue, def, (obj: any) => {
      return obj.completed !== true;
    });
  }

  // TODO We need to tweak this to make sure don't filter locally.
  public topProposals(memberId: EthAddress, orderBy: string|string[] = 'createdOn', lastValue?: any, def = 1000): Observable<Proposal[]> {
    return this.topParent(COL.PROPOSAL, SUB_COL.MEMBERS, memberId, orderBy, lastValue, def, (obj: any) => {
      return (obj.settings.endDate.toDate() && dayjs(obj.settings.endDate.toDate()).isAfter(dayjs(new Date())));
    });
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
