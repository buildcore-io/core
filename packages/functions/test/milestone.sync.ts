import { OutputTypes, TREASURY_OUTPUT_TYPE } from '@iota/iota.js-next';

import { COL, Network, SUB_COL } from '@build-5/interfaces';

import * as adminPackage from 'firebase-admin';
import { last } from 'lodash';
import { build5Db } from '../src/firebase/firestore/build5Db';
import { Wallet } from '../src/services/wallet/wallet';
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
  const lastDocQuery = onlineDb.collection(col).orderBy('createdOn', 'desc').limit(1);
  let lastDoc = (await lastDocQuery.get()).docs[0];

  const wallet = await getWallet(Network.RMS);

  while (1) {
    const snap = await onlineDb
      .collection(col)
      .orderBy('createdOn')
      .startAfter(lastDoc)
      .limit(10)
      .get();
    lastDoc = last(snap.docs) || lastDoc;

    const batch = build5Db().batch();
    snap.docs.forEach((doc) => {
      batch.create(build5Db().doc(doc.ref.path), doc.data());
    });
    await batch.commit();

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const promises = snap.docs.map((doc) => syncTransactions(wallet, doc.ref.path));
    await Promise.all(promises);
  }
};

const syncTransactions = async (wallet: Wallet, parentPath: string) => {
  const snap = await onlineDb.collection(`${parentPath}/${SUB_COL.TRANSACTIONS}`).get();
  const promises = snap.docs.map(async (doc) => {
    const data = doc.data();
    const addresses = getAddesses(data, wallet);
    if (await addressInDb(addresses)) {
      await build5Db()
        .doc(doc!.ref.path)
        .create({ ...doc!.data(), processed: false });
    }
  });
  await Promise.all(promises);
};

const getAddesses = (doc: any, wallet: Wallet) =>
  (doc.payload.essence.outputs as OutputTypes[])
    .filter((o) => o.type !== TREASURY_OUTPUT_TYPE)
    .map((o) => wallet.bechAddressFromOutput(o as any));

const addressInDb = async (addresses: string[]) => {
  for (const address of addresses) {
    const doc = await build5Db().collection(COL.MNEMONIC).doc(address).get();
    if (doc) {
      return true;
    }
  }
  return false;
};

syncMilestones(COL.MILESTONE_RMS);
