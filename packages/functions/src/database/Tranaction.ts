import { COL, Network } from '@soonaverse/interfaces';
import { DatabaseWrite } from './Database';

export interface TransactionCrud {
  getById: <T>(col: COL, uid: string) => Promise<T | undefined>;
  getByValidatedAddress: <T>(
    col: COL.SPACE | COL.MEMBER,
    network: Network,
    address: string,
  ) => Promise<T | undefined>;
}

export interface ITransactionRunner {
  runTransaction: <T>(func: (transaction: ITransaction) => Promise<T>) => Promise<T>;
}

export interface ITransaction extends TransactionCrud {
  update: (update: DatabaseWrite) => void;
}
