import { Base, COL, SUB_COL } from '@soonaverse/interfaces';
import { Firestore } from './firestore/Firestore';
import { FirestoreTransactionRunner } from './firestore/FirestoreTransaction';
import { ITransactionRunner } from './Tranaction';

export interface DatabaseWrite {
  col: COL;
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

  create: <T extends Base>(col: COL, data: T) => Promise<void>;
  update: <T extends Base>(col: COL, data: T, merge?: boolean) => Promise<void>;

  inc: <T>(value: number) => T;

  createBatchWriter: () => IBatchWriter;
}

export const Database: IDatabase = new Firestore();

export const TransactionRunner: ITransactionRunner = new FirestoreTransactionRunner();

export interface IBatchWriter {
  update: (update: DatabaseWrite) => void;
  commit: () => Promise<void>;
}
