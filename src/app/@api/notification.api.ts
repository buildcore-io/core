import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Notification } from '@functions/interfaces/models/notification';
import { COL } from '../../../functions/interfaces/models/base';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class NotificationApi extends BaseApi<Notification> {
  public collection = COL.NOTIFICATION;
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }
}
