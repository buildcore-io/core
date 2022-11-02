import { Injectable } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { COL, Milestone } from '@soonaverse/interfaces';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class MilestoneSmrApi extends BaseApi<Milestone> {
  public collection = COL.MILESTONE_SMR;

  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
  }
}
