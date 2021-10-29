import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Config } from 'functions/interfaces/models/config';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class ConfigApi extends BaseApi<Config> {
  public collection = 'config';
  constructor(protected afs: AngularFirestore) {
    super(afs);
  }
}
