import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { Config } from 'lib/interfaces/config';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class ConfigApi extends BaseApi {
  constructor(private afs: AngularFirestore) {
    super();
  }

  public test(): any {
    // Test retrieval from DB.
    const ref: AngularFirestoreCollection<Config> = this.afs.collection<Config>('config');
    ref.valueChanges().subscribe((d) => {
      d.forEach((v) => {
        console.log(v);
      })
    })
  }
}
