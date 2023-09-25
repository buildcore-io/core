/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  Timestamp,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import { FirebaseApp } from '../../../src/app/app';
import { Firestore } from '../../../src/firestore/firestore';

export const creditHighestPayment = async (app: FirebaseApp) => {
  const db = new Firestore(app);

  if (app.getName() !== 'soonaverse') {
    console.log('Not prod env');
    return;
  }

  const paymentUid = '0xe50e40db6c583e89733fd1b084e30e1d7b878755';
  const batch = db.batch();

  const paymentDocRef = db.doc(`${COL.TRANSACTION}/${paymentUid}`);
  const payment = <Transaction>await paymentDocRef.get();

  batch.update(paymentDocRef, { 'payload.invalidPayment': true });

  // was generated randomly elswhere so getRandomEthAddress is not needed here,
  const creditUid = '0x3c368f6d447e5b703fd5b2d3a9d276809d03affe';
  const credit: Transaction = {
    type: TransactionType.CREDIT,
    uid: creditUid,
    space: payment.space,
    member: payment.member,
    createdOn: Timestamp.now(),
    network: payment.network,
    payload: {
      type: TransactionPayloadType.DATA_NO_LONGER_VALID,
      amount: payment.payload.amount,
      sourceAddress: payment.payload.targetAddress,
      targetAddress: payment.payload.sourceAddress,
      sourceTransaction: [payment.uid],
      nft: payment.payload.nft || null,
      reconciled: true,
      void: false,
      collection: payment.payload.collection || null,
      invalidPayment: true,
    },
    ignoreWallet: false,
  };
  const creditDocRef = db.doc(`${COL.TRANSACTION}/${credit.uid}`);
  batch.create(creditDocRef, credit);

  await batch.commit();
};

export const roll = creditHighestPayment;
