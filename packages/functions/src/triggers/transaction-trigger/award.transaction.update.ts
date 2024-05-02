import { PgTransaction, build5Db } from '@build-5/database';
import {
  COL,
  Network,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import { TransactionPayload, Utils } from '@iota/sdk';
import { getProject } from '../../utils/common.utils';
import { getPathParts } from '../../utils/milestone';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const onAwardUpdate = async (transaction: PgTransaction) => {
  switch (transaction.payload_type) {
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

const onAliasMinted = async (transaction: PgTransaction) => {
  const { col, colId, subCol, subColId } = getPathParts(
    transaction.payload_walletReference_milestoneTransactionPath!,
  );
  const milestoneTransaction = (await build5Db().doc(col, colId, subCol, subColId).get())!;
  const aliasOutputId = Utils.computeOutputId(
    Utils.transactionId(milestoneTransaction.payload as unknown as TransactionPayload),
    0,
  );

  const awardDocRef = build5Db().doc(COL.AWARD, transaction.payload_award!);
  await awardDocRef.update({
    aliasBlockId: milestoneTransaction.blockId as string,
    aliasId: Utils.computeAliasId(aliasOutputId),
  });

  const order: Transaction = {
    project: getProject(transaction),
    type: TransactionType.AWARD,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: transaction.network as Network,
    payload: {
      type: TransactionPayloadType.MINT_COLLECTION,
      sourceAddress: transaction.payload_sourceAddress,
      award: transaction.payload_award,
    },
  };
  await build5Db().doc(COL.TRANSACTION, order.uid).create(order);
};

const onCollectionMinted = async (transaction: PgTransaction) => {
  const { col, colId, subCol, subColId } = getPathParts(
    transaction.payload_walletReference_milestoneTransactionPath!,
  );
  const milestoneTransaction = (await build5Db().doc(col, colId, subCol, subColId).get())!;
  const collectionOutputId = Utils.computeOutputId(
    Utils.transactionId(milestoneTransaction.payload as unknown as TransactionPayload),
    1,
  );

  await build5Db()
    .doc(COL.AWARD, transaction.payload_award!)
    .update({
      collectionBlockId: milestoneTransaction.blockId as string,
      collectionId: Utils.computeNftId(collectionOutputId),
      approved: true,
      rejected: false,
    });
};

const onBadgeMinted = (transaction: PgTransaction) =>
  build5Db()
    .doc(COL.AWARD, transaction.payload_award!)
    .update({ badgesMinted: build5Db().inc(1) });
