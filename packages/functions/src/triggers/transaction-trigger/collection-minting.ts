import { TransactionHelper } from '@iota/iota.js-next';
import {
  COL,
  Collection,
  CollectionStatus,
  Member,
  NftStatus,
  Transaction,
  TransactionMintCollectionType,
  TransactionType,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { get } from 'lodash';
import admin from '../../admin.config';
import { getAddress } from '../../utils/address.utils';
import { indexToString } from '../../utils/block.utils';
import { cOn, uOn } from '../../utils/dateTime.utils';
import { getTransactionPayloadHex } from '../../utils/smr.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const onCollectionMintingUpdate = async (transaction: Transaction) => {
  switch (transaction.payload.type) {
    case TransactionMintCollectionType.MINT_ALIAS: {
      await onCollectionAliasMinted(transaction);
      break;
    }
    case TransactionMintCollectionType.MINT_COLLECTION: {
      await onCollectionMinted(transaction);
      break;
    }
    case TransactionMintCollectionType.MINT_NFTS: {
      await onNftMintSuccess(transaction);
      break;
    }
    case TransactionMintCollectionType.LOCK_COLLECTION: {
      await onCollectionLocked(transaction);
      break;
    }
    case TransactionMintCollectionType.SEND_ALIAS_TO_GUARDIAN: {
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
  const path = transaction.payload.walletReference.milestoneTransactionPath;
  const milestoneTransaction = (await admin.firestore().doc(path).get()).data()!;

  const aliasOutputId = getTransactionPayloadHex(milestoneTransaction.payload) + indexToString(0);
  await admin
    .firestore()
    .doc(`${COL.COLLECTION}/${transaction.payload.collection}`)
    .update(
      uOn({
        'mintingData.aliasBlockId': milestoneTransaction.blockId,
        'mintingData.aliasId': TransactionHelper.resolveIdFromOutputId(aliasOutputId),
        'mintingData.aliasStorageDeposit': transaction.payload.amount,
      }),
    );

  const order = <Transaction>{
    type: TransactionType.MINT_COLLECTION,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: transaction.network,
    payload: {
      type: TransactionMintCollectionType.MINT_COLLECTION,
      amount: get(transaction, 'payload.collectionStorageDeposit', 0),
      sourceAddress: transaction.payload.sourceAddress,
      collection: transaction.payload.collection,
    },
  };
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(cOn(order));
};

const onCollectionMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference.milestoneTransactionPath;
  const milestoneTransaction = (await admin.firestore().doc(path).get()).data()!;
  const collectionOutputId =
    getTransactionPayloadHex(milestoneTransaction.payload) + indexToString(1);
  const collection = <Collection>(
    (
      await admin.firestore().doc(`${COL.COLLECTION}/${transaction.payload.collection}`).get()
    ).data()
  );
  await saveCollectionMintingData(transaction, milestoneTransaction.blockId, collectionOutputId);
  if (collection.mintingData?.nftsToMint) {
    const order = createMintNftsTransaction(transaction);
    await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(cOn(order));
  }
};

const saveCollectionMintingData = (
  transaction: Transaction,
  blockId: string,
  collectionOutputId: string,
) =>
  admin
    .firestore()
    .doc(`${COL.COLLECTION}/${transaction.payload.collection}`)
    .update(
      uOn({
        'mintingData.blockId': blockId,
        'mintingData.nftId': TransactionHelper.resolveIdFromOutputId(collectionOutputId),
        'mintingData.mintedOn': admin.firestore.FieldValue.serverTimestamp(),
      }),
    );

const onNftMintSuccess = async (transaction: Transaction) => {
  const collection = <Collection>(
    (
      await admin.firestore().doc(`${COL.COLLECTION}/${transaction.payload.collection}`).get()
    ).data()
  );
  await admin
    .firestore()
    .doc(`${COL.COLLECTION}/${transaction.payload.collection}`)
    .update(
      uOn({
        'mintingData.nftsToMint': admin.firestore.FieldValue.increment(
          -transaction.payload.nfts.length,
        ),
      }),
    );
  const milestoneTransaction = (
    await admin.firestore().doc(transaction.payload.walletReference.milestoneTransactionPath).get()
  ).data()!;
  const promises = (transaction.payload.nfts as string[]).map((nftId, i) => {
    const outputId = getTransactionPayloadHex(milestoneTransaction.payload) + indexToString(i + 2);
    return admin
      .firestore()
      .doc(`${COL.NFT}/${nftId}`)
      .update(
        uOn({
          'mintingData.network': transaction.network,
          'mintingData.mintedOn': admin.firestore.FieldValue.serverTimestamp(),
          'mintingData.mintedBy': transaction.member,
          'mintingData.blockId': milestoneTransaction.blockId,
          'mintingData.nftId': TransactionHelper.resolveIdFromOutputId(outputId),
          status: NftStatus.MINTED,
        }),
      );
  });
  await Promise.all(promises);
  if (collection.mintingData?.nftsToMint! - transaction.payload.nfts.length > 0) {
    const order = createMintNftsTransaction(transaction);
    await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(cOn(order));
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
      type: TransactionMintCollectionType.MINT_NFTS,
      sourceAddress: transaction.payload.sourceAddress,
      collection: transaction.payload.collection,
    },
  };

const onCollectionLocked = async (transaction: Transaction) => {
  const member = <Member>(
    (await admin.firestore().doc(`${COL.MEMBER}/${transaction.member}`).get()).data()
  );
  const order = <Transaction>{
    type: TransactionType.MINT_COLLECTION,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: transaction.network,
    payload: {
      type: TransactionMintCollectionType.SEND_ALIAS_TO_GUARDIAN,
      amount: transaction.payload.aliasStorageDeposit,
      sourceAddress: transaction.payload.sourceAddress,
      targetAddress: getAddress(member, transaction.network!),
      collection: transaction.payload.collection,
    },
  };
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(cOn(order));
};

const onCollectionAliasTransfered = async (transaction: Transaction) =>
  admin
    .firestore()
    .doc(`${COL.COLLECTION}/${transaction.payload.collection}`)
    .update(uOn({ status: CollectionStatus.MINTED }));
