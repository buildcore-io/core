import {
  COL,
  Collection,
  CollectionStatus,
  Member,
  NftStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import { ITransactionPayload, TransactionHelper } from '@iota/iota.js-next';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions/v2';
import { get } from 'lodash';
import { build5Db } from '../../firebase/firestore/build5Db';
import { getAddress } from '../../utils/address.utils';
import { indexToString } from '../../utils/block.utils';
import { getTransactionPayloadHex } from '../../utils/smr.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const onCollectionMintingUpdate = async (transaction: Transaction) => {
  switch (transaction.payload.type) {
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
      functions.logger.error('Unsupported executable transaction type', transaction);
      throw Error('Unsupported executable transaction type ' + transaction.type);
    }
  }
};

const onCollectionAliasMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference?.milestoneTransactionPath!;
  const milestoneTransaction = (await build5Db().doc(path).get<Record<string, unknown>>())!;

  const aliasOutputId =
    getTransactionPayloadHex(milestoneTransaction.payload as ITransactionPayload) +
    indexToString(0);
  await build5Db()
    .doc(`${COL.COLLECTION}/${transaction.payload.collection}`)
    .update({
      'mintingData.aliasBlockId': milestoneTransaction.blockId,
      'mintingData.aliasId': TransactionHelper.resolveIdFromOutputId(aliasOutputId),
      'mintingData.aliasStorageDeposit': transaction.payload.amount,
    });

  const order = <Transaction>{
    type: TransactionType.MINT_COLLECTION,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: transaction.network,
    payload: {
      type: TransactionPayloadType.MINT_COLLECTION,
      amount: get(transaction, 'payload.collectionStorageDeposit', 0),
      sourceAddress: transaction.payload.sourceAddress,
      collection: transaction.payload.collection,
    },
  };
  await build5Db().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
};

const onCollectionMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference?.milestoneTransactionPath!;
  const milestoneTransaction = (await build5Db().doc(path).get<Record<string, unknown>>())!;
  const collectionOutputId =
    getTransactionPayloadHex(milestoneTransaction.payload as ITransactionPayload) +
    indexToString(1);
  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${transaction.payload.collection}`);
  const collection = (await collectionDocRef.get<Collection>())!;
  await saveCollectionMintingData(
    transaction,
    milestoneTransaction.blockId as string,
    collectionOutputId,
  );
  if (collection.mintingData?.nftsToMint) {
    const order = createMintNftsTransaction(transaction);
    await build5Db().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
  }
};

const saveCollectionMintingData = (
  transaction: Transaction,
  blockId: string,
  collectionOutputId: string,
) =>
  build5Db()
    .doc(`${COL.COLLECTION}/${transaction.payload.collection}`)
    .update({
      'mintingData.blockId': blockId,
      'mintingData.nftId': TransactionHelper.resolveIdFromOutputId(collectionOutputId),
      'mintingData.mintedOn': dayjs().toDate(),
    });

const onNftMintSuccess = async (transaction: Transaction) => {
  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${transaction.payload.collection}`);
  const collection = <Collection>await collectionDocRef.get();
  await build5Db()
    .doc(`${COL.COLLECTION}/${transaction.payload.collection}`)
    .update({
      'mintingData.nftsToMint': build5Db().inc(-transaction.payload.nfts!.length),
    });
  const milestoneTransaction = (await build5Db()
    .doc(transaction.payload.walletReference?.milestoneTransactionPath!)
    .get<Record<string, unknown>>())!;
  const promises = (transaction.payload.nfts as string[]).map((nftId, i) => {
    const outputId =
      getTransactionPayloadHex(milestoneTransaction.payload as ITransactionPayload) +
      indexToString(i + 2);
    return build5Db()
      .doc(`${COL.NFT}/${nftId}`)
      .update({
        'mintingData.network': transaction.network,
        'mintingData.mintedOn': dayjs().toDate(),
        'mintingData.mintedBy': transaction.member,
        'mintingData.blockId': milestoneTransaction.blockId,
        'mintingData.nftId': TransactionHelper.resolveIdFromOutputId(outputId),
        status: NftStatus.MINTED,
      });
  });
  await Promise.all(promises);
  if (collection.mintingData?.nftsToMint! - transaction.payload.nfts!.length > 0) {
    const order = createMintNftsTransaction(transaction);
    await build5Db().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
  }
};

const createMintNftsTransaction = (transaction: Transaction) =>
  <Transaction>{
    type: TransactionType.MINT_COLLECTION,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: transaction.network,
    payload: {
      type: TransactionPayloadType.MINT_NFTS,
      sourceAddress: transaction.payload.sourceAddress,
      collection: transaction.payload.collection,
    },
  };

const onCollectionLocked = async (transaction: Transaction) => {
  const member = (await build5Db().doc(`${COL.MEMBER}/${transaction.member}`).get<Member>())!;
  const order = <Transaction>{
    type: TransactionType.MINT_COLLECTION,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: transaction.network,
    payload: {
      type: TransactionPayloadType.SEND_ALIAS_TO_GUARDIAN,
      amount: transaction.payload.aliasStorageDeposit,
      sourceAddress: transaction.payload.sourceAddress,
      targetAddress: getAddress(member, transaction.network!),
      collection: transaction.payload.collection,
    },
  };
  await build5Db().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
};

const onCollectionAliasTransfered = async (transaction: Transaction) =>
  build5Db()
    .doc(`${COL.COLLECTION}/${transaction.payload.collection}`)
    .update({ status: CollectionStatus.MINTED });
