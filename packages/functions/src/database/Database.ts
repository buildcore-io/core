import { Base, COL, SUB_COL } from '@soonaverse/interfaces';
import { Firestore } from './firestore/Firestore';
import { FirestoreTransactionRunner } from './firestore/FirestoreTransaction';
import { ITransactionRunner } from './Tranaction';

export interface DatabaseWrite {
  col: COL;
  subCol?: SUB_COL;
  parentId?: string;
  data: Base;
  action: 'update' | 'set';
  merge?: boolean;
}

export interface IDatabase {
  getById: <T>(col: COL, uid: string, subCol?: SUB_COL, childId?: string) => Promise<T | undefined>;
  getManyPaginated: <T>(
    col: COL,
    filters: Record<string, unknown>,
    pageSize?: number,
  ) => (onPage: (data: T[]) => Promise<void>) => Promise<void>;
  getAll: <T>(col: COL, parentId: string, subCol: SUB_COL) => Promise<T[]>;

  create: <T extends Base>(col: COL, data: T, subCol?: SUB_COL, parentId?: string) => Promise<void>;
  update: <T extends Base>(
    col: COL,
    data: T,
    subCol?: SUB_COL,
    parentId?: string,
    merge?: boolean,
  ) => Promise<void>;

  inc: <T>(value: number) => T;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arrayUnion: <T>(value: T) => any;

  createBatchWriter: () => IBatchWriter;
}

export const Database: IDatabase = new Firestore();

export const TransactionRunner: ITransactionRunner = new FirestoreTransactionRunner();

export interface IBatchWriter {
  update: <T extends Base>(col: COL, data: T) => void;
  set: <T extends Base>(
    col: COL,
    data: T,
    subCol?: SUB_COL,
    parentId?: string,
    merge?: boolean,
  ) => void;
  commit: () => Promise<void>;
}
