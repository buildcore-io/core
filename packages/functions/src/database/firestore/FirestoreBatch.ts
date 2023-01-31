import { Base, COL } from '@soonaverse/interfaces';
import admin from '../../admin.config';
import { DatabaseWrite, IBatchWriter } from '../Database';
import { cOn, uOn } from './common';

export class FirestoreBatch implements IBatchWriter {
  public readonly updates: DatabaseWrite[] = [];

  public update = <T extends Base>(col: COL, data: T) =>
    this.updates.push({ col, data, action: 'update' });

  public set = <T extends Base>(col: COL, data: T, merge = false) =>
    this.updates.push({ col, data, action: 'set', merge });

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
