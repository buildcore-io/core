import { Injectable } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { COL, Milestone } from '@soon/interfaces';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class MilestoneRmsApi extends BaseApi<Milestone> {
  public collection = COL.MILESTONE_RMS;

  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
  }
}