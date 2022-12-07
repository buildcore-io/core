/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, TransactionOrderType } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';
import admin from '../../../src/admin.config';

export const migrateAirdropOrders = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;
  let count = 0;
  do {
    let query = db
      .collection(COL.TRANSACTION)
      .where('payload.type', '==', TransactionOrderType.AIRDROP_MINTED_TOKEN)
      .limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const batch = admin.firestore().batch();
    snap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.payload.unclaimedAirdrops !== undefined) {
        return;
      }
      const totalAirdropCount = (data.payload.drops || []).reduce(
        (acc: any, act: any) => acc + act.count,
        0,
      );
      batch.update(doc.ref, {
        drops: FieldValue.delete(),
        unclaimedAirdrops: data.drops?.length || 0,
        totalAirdropCount,
      });
      ++count;
    });
    await batch.commit();
  } while (lastDoc);
  console.log(`${count} order updated`);
  return count;
};
