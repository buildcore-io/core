/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Token } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';

export const rollTokenDecimals = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;

  do {
    let query = db.collection(COL.TOKEN).limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const batch = db.batch();
    for (const doc of snap.docs) {
      const token = doc.data() as Token;
      if (token.decimals === undefined || token.decimals === null) {
        batch.update(doc.ref, { decimals: 6 });
      }
    }
    await batch.commit();
  } while (lastDoc);
};

export const roll = rollTokenDecimals;
