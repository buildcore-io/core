import { COL, SUB_COL } from '@build-5/interfaces';

export interface FirestoreDocEvent<T> {
  prev?: T;
  curr?: T;
  path: string;
  col: COL;
  docId: string;
  subCol?: SUB_COL;
  subDocId?: string;
}
