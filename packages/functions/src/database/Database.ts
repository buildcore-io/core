import { Base, COL } from '@soonaverse/interfaces';
import { Firestore } from './firestore/Firestore';
import { FirestoreTransactionRunner } from './firestore/FirestoreTransaction';
import { ITransactionRunner } from './Tranaction';

export interface IDatabase {
  getById: <T>(col: COL, uid: string) => Promise<T | undefined>;
  getManyPaginated: <T>(
    col: COL,
    filters: Record<string, unknown>,
    pageSize?: number,
  ) => (onPage: (data: T[]) => Promise<void>) => Promise<void>;

  create: <T extends Base>(col: COL, data: T) => Promise<void>;
  update: <T extends Base>(col: COL, data: T, merge?: boolean) => Promise<void>;

  inc: <T>(value: number) => T;
}

export const Database: IDatabase = new Firestore();

export const TransactionRunner: ITransactionRunner = new FirestoreTransactionRunner();
