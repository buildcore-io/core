import { Base, COL } from '@soonaverse/interfaces';

export interface TransactionCrud {
  getById: <T>(col: COL, uid: string) => Promise<T | undefined>;
}

export interface TransactionalUpdate {
  col: COL;
  data: Base;
  action: 'update' | 'set';
  merge?: boolean;
}

export interface ITransactionRunner {
  runTransaction: <T>(func: (transaction: ITransaction) => Promise<T>) => Promise<T>;
}

export interface ITransaction extends TransactionCrud {
  update: (update: TransactionalUpdate) => void;
}
