import { COL } from '@soonaverse/interfaces';
import admin from '../../admin.config';
import { DatabaseWrite } from '../Database';
import { ITransaction, ITransactionRunner } from '../Tranaction';
import { cOn, uOn } from './common';

export class FirestoreTransactionRunner implements ITransactionRunner {
  public runTransaction = <T>(func: (transaction: ITransaction) => Promise<T>) =>
    admin.firestore().runTransaction(async (transaction) => {
      const transactionInstance = new FirestoreTransaction(transaction);
      const result = await func(transactionInstance);
      this.submit(transactionInstance);
      return result;
    });

  private submit = (transaction: FirestoreTransaction) =>
    transaction.updates.forEach((params) => {
      const data =
        params.merge || params.action === 'update'
          ? uOn(params.data)
          : cOn(params.data, params.col);
      const docRef = admin.firestore().doc(`${params.col}/${data.uid}`);
      if (params.action === 'set') {
        transaction.instance.set(docRef, data, { merge: params.merge || false });
      } else {
        transaction.instance.update(docRef, data);
      }
    });
}

export class FirestoreTransaction implements ITransaction {
  public readonly updates: DatabaseWrite[] = [];

  constructor(public readonly instance: admin.firestore.Transaction) {}

  public getById = async <T>(col: COL, uid: string) => {
    const docRef = admin.firestore().doc(`${col}/${uid}`);
    const doc = await this.instance.get(docRef);
    return <T | undefined>doc.data();
  };

  public update = (params: DatabaseWrite) => this.updates.push(params);
}
