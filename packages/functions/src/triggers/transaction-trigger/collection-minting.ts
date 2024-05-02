import { PgTransaction, build5Db } from '@build-5/database';
import {
  COL,
  Collection,
  CollectionStatus,
  Network,
  NftStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import { TransactionPayload, Utils } from '@iota/sdk';
import dayjs from 'dayjs';
import { getAddress } from '../../utils/address.utils';
import { getProject } from '../../utils/common.utils';
import { logger } from '../../utils/logger';
import { getPathParts } from '../../utils/milestone';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const onCollectionMintingUpdate = async (transaction: PgTransaction) => {
  switch (transaction.payload_type) {
    case TransactionPayloadType.MINT_ALIAS: {
      await onCollectionAliasMinted(transaction);
      break;
    }
    case TransactionPayloadType.MINT_COLLECTION: {
      await onCollectionMinted(transaction);
      break;
    }
    case TransactionPayloadType.MINT_NFTS: {
      await onNftMintSuccess(transaction);
      break;
    }
    case TransactionPayloadType.LOCK_COLLECTION: {
      await onCollectionLocked(transaction);
      break;
    }
    case TransactionPayloadType.SEND_ALIAS_TO_GUARDIAN: {
      await onCollectionAliasTransfered(transaction);
      break;
    }
    default: {
      logger.error('Unsupported executable transaction type error', transaction);
      throw Error('Unsupported executable transaction type ' + transaction.type);
    }
  }
};

const onCollectionAliasMinted = async (transaction: PgTransaction) => {
  const { col, colId, subCol, subColId } = getPathParts(
    transaction.payload_walletReference_milestoneTransactionPath!,
  );
  const milestoneTransaction = (await build5Db().doc(col, colId, subCol, subColId).get())!;

  const aliasOutputId = Utils.computeOutputId(
    Utils.transactionId(milestoneTransaction.payload as unknown as TransactionPayload),
    0,
  );
  await build5Db()
    .doc(COL.COLLECTION, transaction.payload_collection!)
    .update({
      mintingData_aliasBlockId: milestoneTransaction.blockId as string,
      mintingData_aliasId: Utils.computeAliasId(aliasOutputId),
      mintingData_aliasStorageDeposit: transaction.payload_amount,
    });

  const order: Transaction = {
    project: getProject(transaction),
    type: TransactionType.MINT_COLLECTION,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: transaction.network as Network,
    payload: {
      type: TransactionPayloadType.MINT_COLLECTION,
      amount: transaction.payload_collectionStorageDeposit || 0,
      sourceAddress: transaction.payload_sourceAddress,
      collection: transaction.payload_collection,
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
  const collectionDocRef = build5Db().doc(COL.COLLECTION, transaction.payload_collection!);
  const collection = (await collectionDocRef.get())!;
  await saveCollectionMintingData(
    transaction,
    milestoneTransaction.blockId as string,
    collectionOutputId,
  );
  if (collection.mintingData?.nftsToMint) {
    const order = createMintNftsTransaction(transaction);
    await build5Db().doc(COL.TRANSACTION, order.uid).create(order);
  }
};

const saveCollectionMintingData = (
  transaction: PgTransaction,
  blockId: string,
  collectionOutputId: string,
) =>
  build5Db()
    .doc(COL.COLLECTION, transaction.payload_collection!)
    .update({
      mintingData_blockId: blockId,
      mintingData_nftId: Utils.computeNftId(collectionOutputId),
      mintingData_mintedOn: dayjs().toDate(),
    });

const onNftMintSuccess = async (transaction: PgTransaction) => {
  const batch = build5Db().batch();

  const collectionDocRef = build5Db().doc(COL.COLLECTION, transaction.payload_collection!);
  const collection = <Collection>await collectionDocRef.get();

  batch.update(collectionDocRef, {
    mintingData_nftsToMint: build5Db().inc(-transaction.payload_nfts!.length),
  });

  const { col, colId, subCol, subColId } = getPathParts(
    transaction.payload_walletReference_milestoneTransactionPath!,
  );
  const milestoneTransaction = (await build5Db().doc(col, colId, subCol, subColId).get())!;
  for (let i = 0; i < transaction.payload_nfts!.length; ++i) {
    const nftId = transaction.payload_nfts![i];
    const outputId = Utils.computeOutputId(
      Utils.transactionId(milestoneTransaction.payload as unknown as TransactionPayload),
      i + 2,
    );
    const docRef = build5Db().doc(COL.NFT, nftId);

    batch.update(docRef, {
      mintingData_network: transaction.network,
      mintingData_mintedOn: dayjs().toDate(),
      mintingData_mintedBy: transaction.member,
      mintingData_blockId: milestoneTransaction.blockId as string,
      mintingData_nftId: Utils.computeNftId(outputId),
      status: NftStatus.MINTED,
    });
  }

  if (collection.mintingData?.nftsToMint! - transaction.payload_nfts!.length > 0) {
    const order = createMintNftsTransaction(transaction);
    const docRef = build5Db().doc(COL.TRANSACTION, order.uid);
    batch.create(docRef, order);
  }

  await batch.commit();
};

const createMintNftsTransaction = (transaction: PgTransaction): Transaction => ({
  project: getProject(transaction),
  type: TransactionType.MINT_COLLECTION,
  uid: getRandomEthAddress(),
  member: transaction.member,
  space: transaction.space,
  network: (transaction.network as Network)!,
  payload: {
    type: TransactionPayloadType.MINT_NFTS,
    sourceAddress: transaction.payload_sourceAddress,
    collection: transaction.payload_collection,
  },
});

const onCollectionLocked = async (transaction: PgTransaction) => {
  const member = (await build5Db().doc(COL.MEMBER, transaction.member!).get())!;
  const network = transaction.network as Network;
  const order: Transaction = {
    project: getProject(transaction),
    type: TransactionType.MINT_COLLECTION,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network,
    payload: {
      type: TransactionPayloadType.SEND_ALIAS_TO_GUARDIAN,
      amount: transaction.payload_aliasStorageDeposit,
      sourceAddress: transaction.payload_sourceAddress,
      targetAddress: getAddress(member, network),
      collection: transaction.payload_collection,
    },
  };
  await build5Db().doc(COL.TRANSACTION, order.uid).create(order);
};

const onCollectionAliasTransfered = (transaction: PgTransaction) =>
  build5Db()
    .doc(COL.COLLECTION, transaction.payload_collection!)
    .update({ status: CollectionStatus.MINTED, approved: true });
