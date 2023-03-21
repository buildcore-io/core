/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Nft, TransactionType } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';

export const nftSoldOnRoll = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;

  do {
    let query = db.collection(COL.NFT).where('sold', '==', true).limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const promises = snap.docs.map((doc) => fixSoldOn(db, doc.data() as Nft));
    await Promise.all(promises);
  } while (lastDoc);
};

const fixSoldOn = async (db: FirebaseFirestore.Firestore, nft: Nft) => {
  const snap = await db
    .collection(COL.TRANSACTION)
    .where('payload.nft', '==', nft.uid)
    .where('type', '==', TransactionType.BILL_PAYMENT)
    .orderBy('createdOn')
    .limit(1)
    .get();
  if (snap.size) {
    const nftDocRef = db.doc(`${COL.NFT}/${nft.uid}`);
    await nftDocRef.update({ soldOn: snap.docs[0].data().createdOn });
  }
};

export const roll = nftSoldOnRoll;
