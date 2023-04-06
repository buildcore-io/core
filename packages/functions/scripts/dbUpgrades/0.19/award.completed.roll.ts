/* eslint-disable @typescript-eslint/no-explicit-any */
import { SingleNodeClient, addressBalance } from '@iota/iota.js-next';
import { COL, Transaction, TransactionCreditType, TransactionType } from '@soonaverse/interfaces';
import { FirebaseApp } from '../../../src/firebase/app/app';
import { Firestore } from '../../../src/firebase/firestore/firestore';

const RMS_API_ENDPOINT = 'https://rms1.svrs.io/';
const SMR_API_ENDPOINT = 'https://smr1.svrs.io/';

export const awardCompletedCreditRoll = async (app: FirebaseApp) => {
  const db = new Firestore(app);

  const transactions = await db
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.CREDIT)
    .where('payload.type', '==', TransactionCreditType.AWARD_COMPLETED)
    .where('payload.walletReference.confirmed', '==', false)
    .get<Transaction>();

  console.log(app.getName());
  const endpoint = app.getName() === 'soonaverse' ? SMR_API_ENDPOINT : RMS_API_ENDPOINT;
  const client = new SingleNodeClient(endpoint);

  const promises = transactions.map(async (tran) => {
    const balance = (await addressBalance(client, tran.payload.sourceAddress)).balance;

    const docRef = db.doc(`${COL.TRANSACTION}/${tran.uid}`);
    await docRef.update({
      'payload.amount': Number(balance),
      'payload.walletReference.count': 1,
      'payload.walletReference.error': null,
      shouldRetry: true,
    });
  });
  await Promise.all(promises);
};

export const roll = awardCompletedCreditRoll;
