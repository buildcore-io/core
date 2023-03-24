import { OutputTypes, TREASURY_OUTPUT_TYPE } from '@iota/iota.js-next';

import { COL, MilestoneTransaction, Network, SUB_COL } from '@soonaverse/interfaces';
import dayjs from 'dayjs';

import * as adminPackage from 'firebase-admin';

import { last } from 'lodash';
import { soonDb } from '../src/firebase/firestore/soondb';

import { SmrWallet } from '../src/services/wallet/SmrWalletService';

import { getWallet, projectId } from './set-up';

process.env.FIRESTORE_EMULATOR_HOST = '';
const config = {
  credential: adminPackage.credential.cert('./test-service-account-key.json'),

  databaseURL: `https://${projectId}.firebaseio.com`,
};
const app = adminPackage.initializeApp(config, 'second');
const onlineDb = app.firestore();
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

const syncMilestones = async (col: COL) => {
  let lastDoc = (await onlineDb.collection(col).orderBy('createdOn', 'desc').limit(1).get())
    .docs[0];

  while (1) {
    const snap = await onlineDb
      .collection(col)
      .orderBy('createdOn')
      .startAfter(lastDoc)
      .limit(500)
      .get();
    const batch = soonDb().batch();
    snap.docs.forEach((doc) => batch.create(soonDb().doc(doc.ref.path), doc.data()));
    await batch.commit();

    lastDoc = last(snap.docs) || lastDoc;

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};

const syncTransactions = async () => {
  const wallet = (await getWallet(Network.RMS)) as SmrWallet;

  onlineDb
    .collectionGroup(SUB_COL.TRANSACTIONS)
    .where('processed', '==', false)
    .where('createdOn', '>=', dayjs().toDate())
    .limit(1000)
    .onSnapshot(
      async (snap) => {
        const promise = snap.docs.map(async (doc) => {
          const data = doc.data();
          const network =
            doc.ref.parent.parent?.parent.path === COL.MILESTONE_ATOI ? Network.ATOI : Network.RMS;
          const addresses = await getAddesses(data, network, wallet);
          if (await addressInDb(addresses)) {
            return doc;
          }
          return undefined;
        });
        const docs = (await Promise.all(promise)).filter((d) => d !== undefined);

        const promises = docs.map(async (doc) => {
          try {
            await soonDb().doc(doc!.ref.path).create(doc!.data());
          } catch (error) {}
        });

        await Promise.all(promises);
      },
      (error) => console.log(error),
    );
};

const getAddesses = async (doc: any, network: Network, wallet: SmrWallet) => {
  if (network === Network.ATOI) {
    return (doc as MilestoneTransaction).outputs.map((o) => o.address);
  }
  const promises = (doc.payload.essence.outputs as OutputTypes[])
    .filter((o) => o.type !== TREASURY_OUTPUT_TYPE)
    .map((o) => wallet.bechAddressFromOutput(o as any));
  return await Promise.all(promises);
};

const addressInDb = async (addresses: string[]) => {
  for (const address of addresses) {
    const doc = await soonDb().collection(COL.MNEMONIC).doc(address).get();
    if (doc) {
      return true;
    }
  }
  return false;
};

syncMilestones(COL.MILESTONE_RMS);
syncMilestones(COL.MILESTONE_ATOI);
syncTransactions();
