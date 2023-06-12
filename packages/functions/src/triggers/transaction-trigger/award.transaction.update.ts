import { COL, Transaction, TransactionAwardType, TransactionType } from '@build5/interfaces';
import { ITransactionPayload, TransactionHelper } from '@iota/iota.js-next';
import { soonDb } from '../../firebase/firestore/soondb';
import { indexToString } from '../../utils/block.utils';
import { getTransactionPayloadHex } from '../../utils/smr.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const onAwardUpdate = async (transaction: Transaction) => {
  switch (transaction.payload.type) {
    case TransactionAwardType.MINT_ALIAS: {
      await onAliasMinted(transaction);
      break;
    }
    case TransactionAwardType.MINT_COLLECTION: {
      await onCollectionMinted(transaction);
      break;
    }
    case TransactionAwardType.BADGE: {
      await onBadgeMinted(transaction);
      break;
    }
  }
};

const onAliasMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference.milestoneTransactionPath;
  const milestoneTransaction = (await soonDb().doc(path).get<Record<string, unknown>>())!;
  const aliasOutputId =
    getTransactionPayloadHex(milestoneTransaction.payload as ITransactionPayload) +
    indexToString(0);

  const awardDocRef = soonDb().doc(`${COL.AWARD}/${transaction.payload.award}`);
  await awardDocRef.update({
    aliasBlockId: milestoneTransaction.blockId,
    aliasId: TransactionHelper.resolveIdFromOutputId(aliasOutputId),
  });

  const order = <Transaction>{
    type: TransactionType.AWARD,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: transaction.network,
    payload: {
      type: TransactionAwardType.MINT_COLLECTION,
      sourceAddress: transaction.payload.sourceAddress,
      award: transaction.payload.award,
    },
  };
  await soonDb().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
};

const onCollectionMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference.milestoneTransactionPath;
  const milestoneTransaction = (await soonDb().doc(path).get<Record<string, unknown>>())!;
  const collectionOutputId =
    getTransactionPayloadHex(milestoneTransaction.payload as ITransactionPayload) +
    indexToString(1);

  await soonDb()
    .doc(`${COL.AWARD}/${transaction.payload.award}`)
    .update({
      collectionBlockId: milestoneTransaction.blockId,
      collectionId: TransactionHelper.resolveIdFromOutputId(collectionOutputId),
      approved: true,
      rejected: false,
    });
};

const onBadgeMinted = async (transaction: Transaction) =>
  soonDb()
    .doc(`${COL.AWARD}/${transaction.payload.award}`)
    .update({ badgesMinted: soonDb().inc(1) });
