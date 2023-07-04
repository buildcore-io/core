/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  PublicCollections,
  PublicSubCollections,
  SUB_COL,
  TokenPurchase,
  TokenPurchaseAge,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty, last } from 'lodash';
import { FirebaseApp } from '../../../src/firebase/app/app';
import { Firestore } from '../../../src/firebase/firestore/firestore';
import { IDocument } from '../../../src/firebase/firestore/interfaces';

export const tokenPurchaseRoll = async (app: FirebaseApp) => {
  const db = new Firestore(app);
  let lastDocId = '';

  do {
    const startAfter = await getSnapshot(db, COL.TOKEN_PURCHASE, lastDocId);
    const purchases = await db
      .collection(COL.TOKEN_PURCHASE)
      .where('createdOn', '>=', dayjs().subtract(7, 'd').toDate())
      .startAfter(startAfter)
      .limit(1000)
      .get<TokenPurchase>();
    lastDocId = last(purchases)?.uid || '';

    const promises = purchases
      .filter((purchase) => isEmpty(purchase.age))
      .map(async (purchase) => {
        const batch = db.batch();

        const docRef = db.doc(`${COL.TOKEN_PURCHASE}/${purchase.uid}`);
        const age = Object.values(TokenPurchaseAge).reduce(
          (acc, act) => ({ ...acc, [act]: true }),
          {},
        );
        batch.update(docRef, { age });

        const tokenDocRef = db.doc(`${COL.TOKEN}/${purchase.token}`);
        const statDocRef = tokenDocRef.collection(SUB_COL.STATS).doc(purchase.token);
        const volume = Object.values(TokenPurchaseAge).reduce(
          (acc, act) => ({ ...acc, [act]: db.inc(purchase.count) }),
          {},
        );
        batch.set(statDocRef, { volume }, true);

        await batch.commit();
      });

    await Promise.all(promises);
  } while (lastDocId);
};

export const roll = tokenPurchaseRoll;

const getSnapshot = (
  db: Firestore,
  col: COL | PublicCollections,
  id?: string,
  subCol?: SUB_COL | PublicSubCollections,
  childId?: string,
) => {
  if (!id) {
    return;
  }
  let doc: IDocument = db.doc(`${col}/${id}`);
  if (subCol && childId) {
    doc = doc.collection(subCol).doc(childId);
  }
  return doc.getSnapshot();
};
