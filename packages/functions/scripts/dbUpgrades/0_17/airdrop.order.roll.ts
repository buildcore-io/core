/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, TransactionOrderType } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';

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

    const batch = db.batch();
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
        'payload.drops': FieldValue.delete(),
        'payload.unclaimedAirdrops': data.payload.drops?.length || 0,
        'payload.totalAirdropCount': totalAirdropCount,
      });
      ++count;
    });
    await batch.commit();
  } while (lastDoc);
  console.log(`${count} order updated`);
  return count;
};

export const roll = migrateAirdropOrders;
