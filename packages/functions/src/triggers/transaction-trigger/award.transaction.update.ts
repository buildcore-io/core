import { COL, Transaction, TransactionPayloadType, TransactionType } from '@build-5/interfaces';
import { TransactionPayload, Utils } from '@iota/sdk';
import { build5Db } from '../../firebase/firestore/build5Db';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const onAwardUpdate = async (transaction: Transaction) => {
  switch (transaction.payload.type) {
    case TransactionPayloadType.MINT_ALIAS: {
      await onAliasMinted(transaction);
      break;
    }
    case TransactionPayloadType.MINT_COLLECTION: {
      await onCollectionMinted(transaction);
      break;
    }
    case TransactionPayloadType.BADGE: {
      await onBadgeMinted(transaction);
      break;
    }
  }
};

const onAliasMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference?.milestoneTransactionPath!;
  const milestoneTransaction = (await build5Db().doc(path).get<Record<string, unknown>>())!;
  const aliasOutputId = Utils.computeOutputId(
    Utils.transactionId(milestoneTransaction.payload as TransactionPayload),
    0,
  );

  const awardDocRef = build5Db().doc(`${COL.AWARD}/${transaction.payload.award}`);
  await awardDocRef.update({
    aliasBlockId: milestoneTransaction.blockId,
    aliasId: Utils.computeAliasId(aliasOutputId),
  });

  const order = <Transaction>{
    type: TransactionType.AWARD,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: transaction.network,
    payload: {
      type: TransactionPayloadType.MINT_COLLECTION,
      sourceAddress: transaction.payload.sourceAddress,
      award: transaction.payload.award,
    },
  };
  await build5Db().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
};

const onCollectionMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference?.milestoneTransactionPath!;
  const milestoneTransaction = (await build5Db().doc(path).get<Record<string, unknown>>())!;
  const collectionOutputId = Utils.computeOutputId(
    Utils.transactionId(milestoneTransaction.payload as TransactionPayload),
    1,
  );

  await build5Db()
    .doc(`${COL.AWARD}/${transaction.payload.award}`)
    .update({
      collectionBlockId: milestoneTransaction.blockId,
      collectionId: Utils.computeNftId(collectionOutputId),
      approved: true,
      rejected: false,
    });
};

const onBadgeMinted = async (transaction: Transaction) =>
  build5Db()
    .doc(`${COL.AWARD}/${transaction.payload.award}`)
    .update({ badgesMinted: build5Db().inc(1) });
