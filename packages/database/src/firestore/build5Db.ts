import { COL, Dataset, SUB_COL, Subset } from '@build-5/interfaces';
import { build5App } from '../app/build5App';
import { Firestore } from './firestore';
import { IDatabase } from './interfaces';

export const build5Db = (): IDatabase => new Firestore(build5App);

export const getSnapshot = (
  col: COL | Dataset,
  id?: string,
  subCol?: SUB_COL | Subset,
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
