/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Mnemonic, Network } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';

export const addressNetworkRoll = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any = undefined;
  do {
    let query = db.collection(COL.MNEMONIC).limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const batch = db.batch();

    snap.docs.forEach((doc) => {
      const mnemonic = doc.data() as Mnemonic;
      if (!mnemonic.network || !mnemonic.createdOn) {
        batch.update(doc.ref, {
          network: getNetwork(doc.id),
          createdOn: mnemonic.createdOn || FieldValue.serverTimestamp(),
        });
      }
    });

    await batch.commit();
  } while (lastDoc);
};

const getNetwork = (address: string) => {
  for (const network of Object.values(Network)) {
    if (address.startsWith(network)) {
      return network;
    }
  }
  return '';
};

export const roll = addressNetworkRoll;
