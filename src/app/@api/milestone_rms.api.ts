import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { COL } from '../../../functions/interfaces/models/base';
import { Milestone } from './../../../functions/interfaces/models/milestone';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class MilestoneRmsApi extends BaseApi<Milestone> {
  public collection = COL.MILESTONE_RMS;
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }
}
