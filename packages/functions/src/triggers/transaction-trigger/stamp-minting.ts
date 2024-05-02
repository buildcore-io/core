import { PgTransaction, build5Db } from '@build-5/database';
import {
  COL,
  Network,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import { TransactionPayload, Utils } from '@iota/sdk';
import dayjs from 'dayjs';
import { getProject } from '../../utils/common.utils';
import { getPathParts } from '../../utils/milestone';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const onStampMintUpdate = async (transaction: PgTransaction) => {
  switch (transaction.payload_type) {
    case TransactionPayloadType.MINT_ALIAS: {
      await onAliasMinted(transaction);
      break;
    }
    case TransactionPayloadType.MINT_NFT: {
      await onNftMinted(transaction);
      break;
    }
  }
};

const onAliasMinted = async (transaction: PgTransaction) => {
  const path = transaction.payload_walletReference_milestoneTransactionPath!;
  const { col, colId, subCol, subColId } = getPathParts(path);
  const milestoneTransaction = (await build5Db().doc(col, colId, subCol, subColId).get())!;
  const aliasOutputId = Utils.computeOutputId(
    Utils.transactionId(milestoneTransaction.payload as unknown as TransactionPayload),
    0,
  );
  const aliasId = Utils.computeAliasId(aliasOutputId);

  const batch = build5Db().batch();

  const stampDocRef = build5Db().doc(COL.STAMP, transaction.payload_stamp!);
  batch.update(stampDocRef, { aliasId });

  const spaceDocRef = build5Db().doc(COL.SPACE, transaction.space!);
  batch.update(spaceDocRef, {
    name: `Space of alias: ${aliasId}`,
    alias_address: transaction.payload_targetAddress,
    alias_aliasId: aliasId,
    alias_blockId: milestoneTransaction.blockId as string,
    alias_mintedOn: dayjs().toDate(),
    alias_mintedBy: transaction.member,
  });

  const mintNftOrder: Transaction = {
    project: getProject(transaction),
    type: TransactionType.STAMP,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: transaction.network as Network,
    payload: {
      type: TransactionPayloadType.MINT_NFT,
      sourceAddress: transaction.payload_targetAddress,
      aliasGovAddress: transaction.payload_targetAddress,
      targetAddress: transaction.payload_targetAddress,
      aliasId,
      stamp: transaction.payload_stamp,
    },
  };
  const orderDocRef = build5Db().doc(COL.TRANSACTION, mintNftOrder.uid);
  batch.create(orderDocRef, mintNftOrder);

  await batch.commit();
};

const onNftMinted = async (transaction: PgTransaction) => {
  const path = transaction.payload_walletReference_milestoneTransactionPath!;
  const { col, colId, subCol, subColId } = getPathParts(path);
  const milestoneTransaction = (await build5Db().doc(col, colId, subCol, subColId).get())!;
  const nftOutputId = Utils.computeOutputId(
    Utils.transactionId(milestoneTransaction.payload as unknown as TransactionPayload),
    1,
  );
  const nftId = Utils.computeNftId(nftOutputId);
  const stampDocRef = build5Db().doc(COL.STAMP, transaction.payload_stamp!);
  await stampDocRef.update({ nftId });
};
