import { TransactionHelper } from '@iota/iota.js-next';
import { COL, Transaction, TransactionAwardType, TransactionType } from '@soonaverse/interfaces';
import admin, { inc } from '../../admin.config';
import { indexToString } from '../../utils/block.utils';
import { cOn, uOn } from '../../utils/dateTime.utils';
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
  const milestoneTransaction = (await admin.firestore().doc(path).get()).data()!;
  const aliasOutputId = getTransactionPayloadHex(milestoneTransaction.payload) + indexToString(0);

  const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${transaction.payload.award}`);
  await awardDocRef.update(
    uOn({
      aliasBlockId: milestoneTransaction.blockId,
      aliasId: TransactionHelper.resolveIdFromOutputId(aliasOutputId),
    }),
  );

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
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(cOn(order));
};

const onCollectionMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference.milestoneTransactionPath;
  const milestoneTransaction = (await admin.firestore().doc(path).get()).data()!;
  const collectionOutputId =
    getTransactionPayloadHex(milestoneTransaction.payload) + indexToString(1);

  await admin
    .firestore()
    .doc(`${COL.AWARD}/${transaction.payload.award}`)
    .update(
      uOn({
        collectionBlockId: milestoneTransaction.blockId,
        collectionId: TransactionHelper.resolveIdFromOutputId(collectionOutputId),
        approved: true,
        rejected: false,
      }),
    );
};

const onBadgeMinted = async (transaction: Transaction) =>
  admin
    .firestore()
    .doc(`${COL.AWARD}/${transaction.payload.award}`)
    .update(uOn({ badgesMinted: inc(1) }));
