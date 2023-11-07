import { COL, PublicCollections, PublicSubCollections, SUB_COL } from '@build-5/interfaces';
import { build5App } from '../app/build5App';
import { Firestore } from './firestore';
import { IDatabase } from './interfaces';

export const build5Db = (): IDatabase => new Firestore(build5App);

export const getSnapshot = (
  col: COL | PublicCollections,
  id?: string,
  subCol?: SUB_COL | PublicSubCollections,
  childId?: string,
) => {
  if (!id) {
    return;
  }
  let doc = build5Db().doc(`${col}/${id}`);
  if (subCol && childId) {
    doc = doc.collection(subCol).doc(childId);
  }
  return doc.getSnapshot();
};
