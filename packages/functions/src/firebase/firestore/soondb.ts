import { COL, PublicCollections, PublicSubCollections, SUB_COL } from '@build5/interfaces';
import { soonApp } from '../app/soonApp';
import { Firestore } from './firestore';
import { IDatabase } from './interfaces';

export const soonDb = (): IDatabase => new Firestore(soonApp());

export const getSnapshot = (
  col: COL | PublicCollections,
  id?: string,
  subCol?: SUB_COL | PublicSubCollections,
  childId?: string,
) => {
  if (!id) {
    return;
  }
  let doc = soonDb().doc(`${col}/${id}`);
  if (subCol && childId) {
    doc = doc.collection(subCol).doc(childId);
  }
  return doc.getSnapshot();
};
