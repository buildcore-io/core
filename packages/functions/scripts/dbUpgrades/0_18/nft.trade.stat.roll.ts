/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Transaction, TransactionOrderType, TransactionType } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { App } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { head, last } from 'lodash';

export const rollNftTradeStats = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;
  do {
    let query = db.collection(COL.COLLECTION).limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const promises = snap.docs.map((doc) => setCollectionTradeStat(db, doc.id));
    await Promise.all(promises);
  } while (lastDoc);
};

const setCollectionTradeStat = async (db: FirebaseFirestore.Firestore, collectionId: string) => {
  let lastDoc: any | undefined = undefined;
  let totalTrades = 0;
  let lastTradedOnUnix = 0;

  do {
    let query = db.collection(COL.NFT).where('collection', '==', collectionId).limit(1000);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const promises = snap.docs.map((doc) => setNftTradeStat(db, doc.id));
    const nftStats = await Promise.all(promises);

    totalTrades = nftStats.reduce((sum, act) => sum + act.totalTrades, totalTrades);
    lastTradedOnUnix = nftStats.reduce(
      (acc, act) => Math.max(acc, act.lastTradedOnUnix),
      lastTradedOnUnix,
    );
  } while (lastDoc);

  const collectionDocRef = db.doc(`${COL.COLLECTION}/${collectionId}`);
  await collectionDocRef.update({
    totalTrades,
    lastTradedOn: lastTradedOnUnix ? dateToTimestamp(dayjs.unix(lastTradedOnUnix)) : null,
    updatedOn: FieldValue.serverTimestamp(),
  });
};

const setNftTradeStat = async (db: FirebaseFirestore.Firestore, nftId: string) => {
  const billPaymentsSnap = await db
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.BILL_PAYMENT)
    .where('payload.nft', '==', nftId)
    .get();

  const billPaymentsPromises = billPaymentsSnap.docs.map(async (doc) => {
    const billPayment = doc.data() as Transaction;
    const orderId = head(billPayment.payload.sourceTransaction) || '';
    if (billPayment.payload.royalty || !orderId) {
      return;
    }
    const orderDocRef = db.doc(`${COL.TRANSACTION}/${orderId}`);
    const order = <Transaction>(await orderDocRef.get()).data();
    if (
      order.payload.type !== TransactionOrderType.NFT_PURCHASE &&
      order.payload.type !== TransactionOrderType.NFT_BID
    ) {
      return;
    }
    return doc.data() as Transaction;
  });
  const billPayments = (await Promise.all(billPaymentsPromises)).filter((bp) => bp !== undefined);

  const totalTrades = billPayments.length;
  const lastTradedOnUnix = billPayments.reduce(
    (acc, act) => Math.max(acc, dayjs(act!.createdOn?.toDate()).unix()),
    0,
  );

  const nftDocRef = db.doc(`${COL.NFT}/${nftId}`);
  await nftDocRef.update({
    totalTrades,
    lastTradedOn: lastTradedOnUnix ? dateToTimestamp(dayjs.unix(lastTradedOnUnix)) : null,
    updatedOn: FieldValue.serverTimestamp(),
  });

  return { totalTrades, lastTradedOnUnix };
};

export const dateToTimestamp = (d: dayjs.ConfigType, onlyDownToMinutes = false) => {
  const date = onlyDownToMinutes ? dayjs(d).second(0).millisecond(0) : dayjs(d);
  return Timestamp.fromDate(date.toDate()) as Timestamp;
};

export const roll = rollNftTradeStats;
