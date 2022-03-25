import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Notification } from '@functions/interfaces/models/notification';
import { Observable } from 'rxjs';
import { COL } from '../../../functions/interfaces/models/base';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class NotificationApi extends BaseApi<Notification> {
  public collection = COL.NOTIFICATION;
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }

  public topMember(memberUid: string, lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<Notification[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def, (ref: any) => {
      return ref.where('member', '==', memberUid);
    });
  }
}
