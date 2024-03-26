import { BaseRecord } from '@build-5/database';
import { COL, SUB_COL } from '@build-5/interfaces';

export interface PgDocEvent<T extends BaseRecord> {
  prev: T;
  curr?: T;
  col: COL;
  uid: string;
  subCol?: SUB_COL;
  subColId?: string;
}
