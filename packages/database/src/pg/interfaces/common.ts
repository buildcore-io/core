import { COL, SUB_COL } from '@buildcore/interfaces';
import { BaseRecord } from '../models/common';

export interface PKey {
  uid: string;
  parentId?: string;
}

export interface Converter<C, B extends BaseRecord> {
  toPg: (data: C) => B;
  fromPg: (data: B) => C;
}

export type WhereFilterOp = '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains';

export const getTableName = (col: COL, subCol?: SUB_COL) =>
  (col + (subCol ? '_' + subCol : '')).toLowerCase();

export class Increment {
  constructor(public value: number) {}
}

export class ArrayUnion<T> {
  constructor(public value: T) {}
}

export class ArrayRemove<T> {
  constructor(public value: T) {}
}
