import { Base, COL, SUB_COL } from '@soonaverse/interfaces';
import { last } from 'lodash';
import admin from '../../admin.config';
import { IDatabase } from '../Database';
import { cOn, uOn } from './common';
import { FirestoreBatch } from './FirestoreBatch';

export class Firestore implements IDatabase {
  public getById = async <T>(col: COL, uid: string, subCol?: SUB_COL, childId?: string) => {
    let docRef = admin.firestore().doc(`${col}/${uid}`);
    if (subCol && childId) {
      docRef = docRef.collection(subCol).doc(childId);
    }
    return <T | undefined>(await docRef.get()).data();
  };

  public getManyPaginated =
    <T>(col: COL, filters: Record<string, unknown>, pageSize = 500) =>
    async (onPage: (data: T[]) => Promise<void>) => {
      let lastDoc: LastDocType | undefined = undefined;
      do {
        let query = admin.firestore().collection(col).limit(pageSize);
        Object.entries(filters).forEach(([key, value]) => (query = query.where(key, '==', value)));
        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }
        const snap = await query.get();
        await onPage(snap.docs.map((d) => <T>d.data()));
        lastDoc = last(snap.docs);
      } while (lastDoc);
    };

  public getAll = async <T>(col: COL, parentId: string, subCol: SUB_COL) => {
    const snap = await admin.firestore().collection(`${col}/${parentId}/${subCol}`).get();
    return snap.docs.map((doc) => doc.data() as T);
  };

  public create = async <T extends Base>(
    col: COL,
    data: T,
    subCol?: SUB_COL,
    parentId?: string,
  ) => {
    const path =
      subCol && parentId ? `${col}/${parentId}/${subCol}/${data.uid}` : `${col}/${data.uid}`;
    const docRef = admin.firestore().doc(path);
    await docRef.create(cOn(data, col));
  };

  public update = async <T extends Base>(
    col: COL,
    data: T,
    subCol?: SUB_COL,
    parentId?: string,
    merge = true,
  ) => {
    const path =
      subCol && parentId ? `${col}/${parentId}/${subCol}/${data.uid}` : `${col}/${data.uid}`;
    const docRef = admin.firestore().doc(path);
    await docRef.set(uOn(data), { merge });
  };

  public inc = <T>(value: number) => admin.firestore.FieldValue.increment(value) as T;

  public arrayUnion = <T>(value: T) => admin.firestore.FieldValue.arrayUnion(value);

  public createBatchWriter = () => new FirestoreBatch();
}

type LastDocType = admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>;
