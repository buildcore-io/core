import { FirebaseApp } from '@build-5/database';
import { COL, Transaction, TransactionType } from '@build-5/interfaces';
import dayjs from 'dayjs';
import admin from 'firebase-admin';
import { last } from 'lodash';

export const EXECUTABLE = [
  TransactionType.BILL_PAYMENT,
  TransactionType.MINT_COLLECTION,
  TransactionType.MINT_TOKEN,
  TransactionType.CREDIT_NFT,
  TransactionType.WITHDRAW_NFT,
  TransactionType.UNLOCK,
  TransactionType.AWARD,
  TransactionType.METADATA_NFT,
  TransactionType.STAMP,
  TransactionType.CREDIT,
  TransactionType.CREDIT_TANGLE_REQUEST,
  TransactionType.CREDIT_STORAGE_DEPOSIT_LOCKED,
];

export const retryNftWithdraw = async (app: FirebaseApp) => {
  const instance = app.getInstance() as admin.app.App;
  const firestore = instance.firestore();

  let lastDoc: any = undefined;
  let processed = 0;
  let retry = 0;
  do {
    let query = firestore
      .collection(COL.TRANSACTION)
      .where('createdOn', '>=', dayjs('2023-12-01T00:00:00.000Z').toDate())
      .where('createdOn', '<=', dayjs().subtract(30, 'm').toDate())
      .orderBy('createdOn')
      .limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);
    processed += snap.size;

    const batch = firestore.batch();
    for (const doc of snap.docs) {
      const data = doc.data() as Transaction;

      if (!EXECUTABLE.includes(data.type)) {
        continue;
      }

      if (data.ignoreWallet && data.payload.walletReference?.confirmed === false) {
        batch.update(doc.ref, {
          shouldRetry: false,
          'payload.walletReference': admin.firestore.FieldValue.delete(),
        });
        continue;
      }

      if (!data.payload.walletReference?.confirmed) {
        ++retry;
        batch.update(doc.ref, {
          shouldRetry: true,
          'payload.walletReference.confirmed': false,
          'payload.walletReference.inProgress': false,
          'payload.walletReference.chainReference': null,
          'payload.walletReference.error': null,
          'payload.walletReference.count': 1,
        });
      }
    }
    await batch.commit();

    console.log('processed', processed);
    console.log('retry', retry);
  } while (lastDoc);
};

export const roll = retryNftWithdraw;
