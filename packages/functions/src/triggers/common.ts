import { BaseRecord } from '@buildcore/database';
import { COL, SUB_COL } from '@buildcore/interfaces';

export interface PgDocEvent<T extends BaseRecord> {
  prev: T;
  curr?: T;
  col: COL;
  uid: string;
  subCol?: SUB_COL;
  subColId?: string;
}
