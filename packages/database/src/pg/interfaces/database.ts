import { COL, SUB_COL } from '@build-5/interfaces';
import { Knex } from 'knex';
import { IColType, IDocType } from '../impl/postgres';
import { IBatch } from './batch';
import { ArrayRemove, ArrayUnion, Increment } from './common';
import { ITransaction } from './transaction';

export interface IDatabase {
  collection: <C extends COL, S extends SUB_COL | undefined = undefined>(
    col: C,
    colId?: string,
    subCol?: S,
  ) => IColType<C, S>;

  doc: <C extends COL, S extends SUB_COL | undefined = undefined>(
    col: C,
    colId: string,
    subCol?: S,
    subColId?: string,
  ) => IDocType<C, S>;

  batch: () => IBatch;
  runTransaction: <T>(func: (transaction: ITransaction) => Promise<T>) => Promise<T>;

  inc: (value: number) => Increment;
  arrayUnion: <T>(value: T) => ArrayUnion<T>;
  arrayRemove: <T>(value: T) => ArrayRemove<T>;

  destroy: () => Promise<void>;

  getCon: () => Knex;
}
