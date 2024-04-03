import { COL, Network, SUB_COL, Transaction, getMilestoneCol } from '@build-5/interfaces';
import { Client } from '@iota/sdk';
import dayjs from 'dayjs';
import * as admin from 'firebase-admin';

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

admin.initializeApp();

const client = new Client({ nodes: ['https://rms1.svrs.io/'] });

const downloadBlocks = async () => {
  admin
    .firestore()
    .collection('blocks')
    .orderBy('createdOn', 'desc')
    .limit(1)
    .onSnapshot((snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          saveBlock(change.doc.data().blockId);
        }
      });
    });
};

const saveBlock = async (blockId: string) => {
  const metadata = await getBlockMetadata(blockId);
  if (metadata?.ledgerInclusionState !== 'included') {
    return;
  }

  const block = await client.getBlock(blockId);
  const milestonDocRef = admin
    .firestore()
    .collection(getMilestoneCol(Network.RMS))
    .doc(metadata.referencedByMilestoneIndex + '');
  if (!(await milestonDocRef.get()).exists) {
    await milestonDocRef.set({
      milestone: metadata.referencedByMilestoneIndex,
      createdOn: dayjs().toDate(),
    });
  }
  await milestonDocRef
    .collection(SUB_COL.TRANSACTIONS)
    .doc(blockId)
    .create({
      blockId,
      createdOn: dayjs().toDate(),
      milestone: metadata.referencedByMilestoneIndex,
      payload: JSON.parse(JSON.stringify(block.payload)),
      processed: false,
    });
};

const getBlockMetadata = async (blockId: string) => {
  for (let attempt = 0; attempt < 1200; ++attempt) {
    const metadata = await client.getBlockMetadata(blockId);
    if (metadata.ledgerInclusionState) {
      return metadata;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return;
};

downloadBlocks();

const transactionToBlock = () => {
  admin
    .firestore()
    .collection(COL.TRANSACTION)
    .orderBy('updatedOn', 'desc')
    .limit(1)
    .onSnapshot(async (snap) => {
      for (const doc of snap.docs) {
        const transaction = doc.data() as Transaction;
        const chainReference = transaction.payload.walletReference?.chainReference;
        if (chainReference && !chainReference.startsWith('payment')) {
          try {
            await admin
              .firestore()
              .collection('blocks')
              .doc(chainReference)
              .create({ blockId: chainReference, createdOn: dayjs().toDate() });
          } catch {}
        }
      }
    });
};

transactionToBlock();
