import admin from '../../admin.config';
import { DatabaseWrite, IBatchWriter } from '../Database';
import { cOn, uOn } from './common';

export class FirestoreBatch implements IBatchWriter {
  public readonly updates: DatabaseWrite[] = [];

  public update = (params: DatabaseWrite) => this.updates.push(params);

  public commit = async () => {
    const batch = admin.firestore().batch();

    this.updates.forEach((params) => {
      const data =
        params.merge || params.action === 'update'
          ? uOn(params.data)
          : cOn(params.data, params.col);

      const docRef = admin.firestore().doc(`${params.col}/${data.uid}`);

      if (params.action === 'set') {
        batch.set(docRef, data, { merge: params.merge || false });
      } else {
        batch.update(docRef, data);
      }
    });

    await batch.commit();
  };
}