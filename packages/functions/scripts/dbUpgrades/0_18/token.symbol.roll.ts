/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Token, Transaction, TransactionType } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { isEmpty, last } from 'lodash';

export const setTokenSymbolOnTransactions = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;
  do {
    let query = db
      .collection(COL.TRANSACTION)
      .where('type', 'in', [
        TransactionType.PAYMENT,
        TransactionType.BILL_PAYMENT,
        TransactionType.CREDIT,
      ])
      .limit(1000);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const promises = snap.docs.map((doc) =>
      setTokenSymbolOnTransaction(db, doc.data() as Transaction),
    );
    await Promise.all(promises);
  } while (lastDoc);
};

const setTokenSymbolOnTransaction = async (
  db: FirebaseFirestore.Firestore,
  transaction: Transaction,
) => {
  if (isEmpty(transaction.payload.token) || !isEmpty(transaction.payload.tokenSymbol)) {
    return;
  }

  const tokenDocRef = db.doc(`${COL.TOKEN}/${transaction.payload.token}`);
  const token = <Token | undefined>(await tokenDocRef.get()).data();
  const transactionDocRef = db.doc(`${COL.TRANSACTION}/${transaction.uid}`);
  await transactionDocRef.update({ 'payload.tokenSymbol': token?.symbol || null });
};

export const roll = setTokenSymbolOnTransactions;
