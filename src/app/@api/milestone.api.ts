import { Injectable } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { COL } from '../../../functions/interfaces/models/base';
import { Milestone } from './../../../functions/interfaces/models/milestone';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class MilestoneApi extends BaseApi<Milestone> {
  public collection = COL.MILESTONE;

  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
  }
}
