import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Firestore, where } from '@angular/fire/firestore';
import { COL, Notification } from '@soonaverse/interfaces';
import { Observable } from 'rxjs';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class NotificationApi extends BaseApi<Notification> {
  public collection = COL.NOTIFICATION;

  constructor(protected firestore: Firestore, protected httpClient: HttpClient) {
    super(firestore, httpClient);
  }

  public topMember(
    memberUid: string,
    lastValue?: number,
    def = DEFAULT_LIST_SIZE,
  ): Observable<Notification[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
      constraints: [where('member', '==', memberUid)],
    });
  }
}
