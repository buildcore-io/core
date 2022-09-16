import { Injectable } from '@angular/core';
import { Firestore, where } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { Notification } from '@functions/interfaces/models/notification';
import { Observable } from 'rxjs';
import { COL } from '../../../functions/interfaces/models/base';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class NotificationApi extends BaseApi<Notification> {
  public collection = COL.NOTIFICATION;
  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
  }

  public topMember(memberUid: string, lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<Notification[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
      constraints: [
        where('member', '==', memberUid)
      ]
    });
  }
}
