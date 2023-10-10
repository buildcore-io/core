import {
  COL,
  Collection,
  DEFAULT_NETWORK,
  Member,
  Nft,
  NftStatus,
  Space,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import { TransactionPayload, Utils } from '@iota/sdk';
import dayjs from 'dayjs';
import { get } from 'lodash';
import { build5Db } from '../../firebase/firestore/build5Db';
import {
  createMetadataCollection,
  createMetadataNft,
  createMintMetadataCollectionOrder,
  createMintMetadataNftOrder,
} from '../../services/payment/metadataNft-service';
import { WalletService } from '../../services/wallet/wallet.service';
import { getAddress } from '../../utils/address.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const onMetadataNftMintUpdate = async (transaction: Transaction) => {
  switch (transaction.payload.type) {
    case TransactionPayloadType.MINT_ALIAS: {
      await onAliasMinted(transaction);
      break;
    }
    case TransactionPayloadType.MINT_COLLECTION: {
      await onCollectionMinted(transaction);
      break;
    }
    case TransactionPayloadType.MINT_NFT: {
      await onNftMinted(transaction);
      break;
    }
    case TransactionPayloadType.UPDATE_MINTED_NFT: {
      await onNftUpdated(transaction);
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

  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${transaction.space}`);
  batch.update(spaceDocRef, {
    alias: {
      address: transaction.payload.targetAddress,
      aliasId,
      blockId: milestoneTransaction.blockId,
      mintedOn: dateToTimestamp(dayjs()),
      mintedBy: transaction.member,
    },
  });

  const collection = createMetadataCollection(transaction.space!);
  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${collection.uid}`);
  batch.create(collectionDocRef, collection);

  const order = createMintMetadataCollectionOrder(
    transaction,
    collection.uid,
    aliasId,
    get(transaction, 'payload.orderId', ''),
    transaction.payload.targetAddress!,
    milestoneTransaction.blockId as string,
  );
  const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
  batch.create(orderDocRef, order);

  await batch.commit();
};

const onCollectionMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference?.milestoneTransactionPath!;
  const milestoneTransaction = (await build5Db().doc(path).get<Record<string, unknown>>())!;
  const collectionOutputId = Utils.computeOutputId(
    Utils.transactionId(milestoneTransaction.payload as TransactionPayload),
    1,
  );
  const collectionId = Utils.computeNftId(collectionOutputId);

  const batch = build5Db().batch();

  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${transaction.payload.collection}`);
  batch.update(collectionDocRef, {
    mintingData: {
      address: transaction.payload.targetAddress,
      network: transaction.network,
      mintedOn: dateToTimestamp(dayjs()),
      mintedBy: transaction.member,
      blockId: milestoneTransaction.blockId,
      nftId: collectionId,
      storageDeposit: get(transaction, 'payload.collectionOutputAmount', 0),
      aliasBlockId: get(transaction, 'payload.aliasBlockId', ''),
      aliasId: get(transaction, 'payload.aliasId', ''),
    },
  });

  const order = await build5Db()
    .doc(`${COL.TRANSACTION}/${transaction.payload.orderId}`)
    .get<Transaction>();

  const nft = createMetadataNft(
    transaction.member!,
    transaction.space!,
    transaction.payload.collection!,
    get(order, 'payload.metadata', {}),
  );
  const nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
  batch.create(nftDocRef, nft);

  const space = await build5Db().doc(`${COL.SPACE}/${transaction.space}`).get<Space>();

  const nftMintOrder = createMintMetadataNftOrder(
    nft,
    transaction.network!,
    transaction.payload.targetAddress!,
    space?.alias?.address!,
    transaction.payload.targetAddress!,
    get(transaction, 'payload.aliasId', ''),
    collectionId,
    get(transaction, 'payload.orderId', ''),
  );
  const nftMintOrderDocRef = build5Db().doc(`${COL.TRANSACTION}/${nftMintOrder.uid}`);
  batch.create(nftMintOrderDocRef, nftMintOrder);

  await batch.commit();
};

const onNftMinted = async (transaction: Transaction) => {
  const path = transaction.payload.walletReference?.milestoneTransactionPath!;
  const milestoneTransaction = (await build5Db().doc(path).get<Record<string, unknown>>())!;
  const nftOutputId = Utils.computeOutputId(
    Utils.transactionId(milestoneTransaction.payload as TransactionPayload),
    2,
  );
  const nftId = Utils.computeNftId(nftOutputId);

  const batch = build5Db().batch();

  const nftDocRef = build5Db().doc(`${COL.NFT}/${transaction.payload.nft}`);
  const nft = await nftDocRef.get<Nft>();
  batch.update(nftDocRef, {
    status: NftStatus.MINTED,
    mintingData: {
      address: transaction.payload.targetAddress,
      network: transaction.network,
      mintedOn: dateToTimestamp(dayjs()),
      mintedBy: transaction.member,
      blockId: milestoneTransaction.blockId,
      nftId,
    },
  });

  const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${transaction.payload.orderId}`);
  const order = <Transaction>await orderDocRef.get();

  const storageDepositTotal =
    get(order, 'payload.aliasOutputAmount', 0) +
    get(order, 'payload.collectionOutputAmount', 0) +
    get(order, 'payload.nftOutputAmount', 0);

  const member = await build5Db().doc(`${COL.MEMBER}/${transaction.member}`).get<Member>();
  const collection = await build5Db().doc(`${COL.COLLECTION}/${nft?.collection}`).get<Collection>();
  const space = await build5Db().doc(`${COL.SPACE}/${collection?.space}`).get<Space>();

  const creditTransaction = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: transaction.space,
    member: transaction.member,
    network: order.network,
    payload: {
      type: TransactionPayloadType.MINT_METADATA_NFT,
      amount: order.payload.amount! - storageDepositTotal,
      sourceAddress: order.payload.targetAddress,
      targetAddress: getAddress(member, order.network || DEFAULT_NETWORK),
      reconciled: true,
      void: false,
      customMetadata: {
        nftId,
        collectionId: collection?.mintingData?.nftId || '',
        aliasId: space?.alias?.aliasId || '',
      },
      tag: order.payload.tag || '',
    },
  };
  const creditDocRef = build5Db().doc(`${COL.TRANSACTION}/${creditTransaction.uid}`);
  batch.create(creditDocRef, creditTransaction);

  await batch.commit();
};

const onNftUpdated = async (transaction: Transaction) => {
  const batch = build5Db().batch();

  const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${transaction.payload.orderId}`);
  const order = <Transaction>await orderDocRef.get();

  const nftDocRef = build5Db().doc(`${COL.NFT}/${transaction.payload.nft}`);
  const nft = await nftDocRef.get<Nft>();
  batch.update(nftDocRef, {
    properties: order.payload.metadata,
  });

  const wallet = await WalletService.newWallet(transaction.network!);
  const { amount: balance } = await wallet.getBalance(order.payload.targetAddress!);

  const member = await build5Db().doc(`${COL.MEMBER}/${transaction.member}`).get<Member>();
  const collection = await build5Db().doc(`${COL.COLLECTION}/${nft?.collection}`).get<Collection>();
  const space = await build5Db().doc(`${COL.SPACE}/${collection?.space}`).get<Space>();

  const creditTransaction = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: transaction.space,
    member: transaction.member,
    network: order.network,
    payload: {
      type: TransactionPayloadType.MINT_METADATA_NFT,
      amount: Number(balance),
      sourceAddress: order.payload.targetAddress,
      targetAddress: getAddress(member, order.network || DEFAULT_NETWORK),
      reconciled: true,
      void: false,
      customMetadata: {
        nftId: nft?.mintingData?.nftId || '',
        collectionId: collection?.mintingData?.nftId || '',
        aliasId: space?.alias?.aliasId || '',
      },
      tag: order.payload.tag || '',
    },
  };
  const creditDocRef = build5Db().doc(`${COL.TRANSACTION}/${creditTransaction.uid}`);
  batch.create(creditDocRef, creditTransaction);

  await batch.commit();
};
