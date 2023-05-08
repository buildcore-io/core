/* eslint-disable @typescript-eslint/no-explicit-any */

import { INftOutput, IndexerPluginClient, SingleNodeClient } from '@iota/iota.js-next';
import { COL, Transaction, TransactionType } from '@soonaverse/interfaces';
import { FirebaseApp } from '../../../src/firebase/app/app';
import { Firestore } from '../../../src/firebase/firestore/firestore';

export const nftCreditRoll = async (app: FirebaseApp) => {
  const db = new Firestore(app);

  const transactions = await db
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.CREDIT)
    .where('payload.walletReference.count', '==', 6)
    .get<Transaction>();

  for (const trans of transactions) {
    const address = trans.payload.sourceAddress as string;
    if (!address.startsWith('smr')) {
      continue;
    }

    const client = new SingleNodeClient('https://smr1.svrs.io/');
    const indexer = new IndexerPluginClient(client);
    const nfts = (await indexer.nfts({ addressBech32: address })).items;
    if (nfts.length !== 1) {
      continue;
    }

    const outputResponse = await client.output(nfts[0]);
    const nftOutput = outputResponse.output as INftOutput;

    const transDocRef = db.doc(`${COL.TRANSACTION}/${trans.uid}`);
    await transDocRef.update({
      type: TransactionType.CREDIT_NFT,
      'payload.nftId': nftOutput.nftId,
      'payload.walletReference.count': 1,
      shouldRetry: true,
    });
  }
};

export const roll = nftCreditRoll;
