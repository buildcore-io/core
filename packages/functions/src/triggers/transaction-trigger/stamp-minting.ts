import { build5Db } from '@build-5/database';
import { COL, Transaction, TransactionPayloadType, TransactionType } from '@build-5/interfaces';
import { TransactionPayload, Utils } from '@iota/sdk';
import dayjs from 'dayjs';
import { getProject } from '../../utils/common.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const onStampMintUpdate = async (transaction: Transaction) => {
  switch (transaction.payload.type) {
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

const onAliasMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference?.milestoneTransactionPath!;
  const milestoneTransaction = (await build5Db().doc(path).get<Record<string, unknown>>())!;
  const aliasOutputId = Utils.computeOutputId(
    Utils.transactionId(milestoneTransaction.payload as TransactionPayload),
    0,
  );
  const aliasId = Utils.computeAliasId(aliasOutputId);

  const batch = build5Db().batch();

  const stampDocRef = build5Db().doc(`${COL.STAMP}/${transaction.payload.stamp}`);
  batch.update(stampDocRef, { aliasId });

  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${transaction.space}`);
  batch.update(spaceDocRef, {
    name: `Space of alias: ${aliasId}`,
    alias: {
      address: transaction.payload.targetAddress,
      aliasId,
      blockId: milestoneTransaction.blockId,
      mintedOn: dateToTimestamp(dayjs()),
      mintedBy: transaction.member,
    },
  });

  const mintNftOrder: Transaction = {
    project: getProject(transaction),
    type: TransactionType.STAMP,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: transaction.network,
    payload: {
      type: TransactionPayloadType.MINT_NFT,
      sourceAddress: transaction.payload.targetAddress,
      aliasGovAddress: transaction.payload.targetAddress,
      targetAddress: transaction.payload.targetAddress,
      aliasId,
      stamp: transaction.payload.stamp,
    },
  };
  const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${mintNftOrder.uid}`);
  batch.create(orderDocRef, mintNftOrder);

  await batch.commit();
};

const onNftMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference?.milestoneTransactionPath!;
  const milestoneTransaction = (await build5Db().doc(path).get<Record<string, unknown>>())!;
  const nftOutputId = Utils.computeOutputId(
    Utils.transactionId(milestoneTransaction.payload as TransactionPayload),
    1,
  );
  const nftId = Utils.computeNftId(nftOutputId);
  const stampDocRef = build5Db().doc(`${COL.STAMP}/${transaction.payload.stamp}`);
  await stampDocRef.update({ nftId });
};
