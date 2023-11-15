import { FirebaseApp, Firestore } from '@build-5/database';
import { COL, Transaction, TransactionPayloadType } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { chunk } from 'lodash';

const airdropOrderTypes = [
  TransactionPayloadType.TOKEN_AIRDROP,
  TransactionPayloadType.CLAIM_MINTED_TOKEN,
  TransactionPayloadType.CLAIM_BASE_TOKEN,
];

export const claimOrderFix = async (app: FirebaseApp) => {
  const db = new Firestore(app);

  const orders = await db
    .collection(COL.TRANSACTION)
    .where('payload.reconciled', '==', true)
    .where('payload.type', 'in', airdropOrderTypes)
    .where('createdOn', '>=', dayjs().startOf('d').toDate())
    .get<Transaction>();

  const chunks = chunk(orders, 500);

  await updateReconciled(db, chunks, false);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await updateReconciled(db, chunks, true);
};

const updateReconciled = async (db: Firestore, chunks: Transaction[][], reconciled: boolean) => {
  for (const chunk of chunks) {
    const batch = db.batch();
    for (const order of chunk) {
      const docRef = db.doc(`${COL.TRANSACTION}/${order.uid}`);
      batch.update(docRef, { 'payload.reconciled': true });
    }
    await batch.commit();
  }
};

export const roll = claimOrderFix;
