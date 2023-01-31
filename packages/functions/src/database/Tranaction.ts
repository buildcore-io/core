import { COL } from '@soonaverse/interfaces';
import { DatabaseWrite } from './Database';

export interface TransactionCrud {
  getById: <T>(col: COL, uid: string) => Promise<T | undefined>;
}

export interface ITransactionRunner {
  runTransaction: <T>(func: (transaction: ITransaction) => Promise<T>) => Promise<T>;
}

export interface ITransaction extends TransactionCrud {
  update: (update: DatabaseWrite) => void;
}
