import { PgTransaction, database } from '@buildcore/database';
import {
  COL,
  Collection,
  DEFAULT_NETWORK,
  Network,
  NftStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@buildcore/interfaces';
import { TransactionPayload, Utils } from '@iota/sdk';
import dayjs from 'dayjs';
import {
  createMetadataCollection,
  createMetadataNft,
  createMintMetadataCollectionOrder,
  createMintMetadataNftOrder,
} from '../../services/payment/metadataNft-service';
import { WalletService } from '../../services/wallet/wallet.service';
import { getAddress } from '../../utils/address.utils';
import { getProject } from '../../utils/common.utils';
import { getPathParts } from '../../utils/milestone';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const onMetadataNftMintUpdate = async (transaction: PgTransaction) => {
  switch (transaction.payload_type) {
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

const onAliasMinted = async (transaction: PgTransaction) => {
  const { col, colId, subCol, subColId } = getPathParts(
    transaction.payload_walletReference_milestoneTransactionPath!,
  );
  const milestoneTransaction = (await database().doc(col, colId, subCol, subColId).get())!;
  const aliasOutputId = Utils.computeOutputId(
    Utils.transactionId(milestoneTransaction.payload as unknown as TransactionPayload),
    0,
  );
  const aliasId = Utils.computeAliasId(aliasOutputId);

  const batch = database().batch();

  const spaceDocRef = database().doc(COL.SPACE, transaction.space!);
  batch.update(spaceDocRef, {
    name: `Space of alias: ${aliasId}`,
    alias_address: transaction.payload_targetAddress,
    alias_aliasId: aliasId,
    alias_blockId: milestoneTransaction.blockId as string,
    alias_mintedOn: dayjs().toDate(),
    alias_mintedBy: transaction.member,
  });

  const collection = createMetadataCollection(getProject(transaction), transaction.space!);
  const collectionDocRef = database().doc(COL.COLLECTION, collection.uid);
  batch.create(collectionDocRef, collection as Collection);

  const order = createMintMetadataCollectionOrder(
    transaction,
    collection.uid,
    aliasId,
    transaction.payload_orderId!,
    transaction.payload_targetAddress!,
    milestoneTransaction.blockId as string,
  );
  const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
  batch.create(orderDocRef, order);

  await batch.commit();
};

const onCollectionMinted = async (transaction: PgTransaction) => {
  const { col, colId, subCol, subColId } = getPathParts(
    transaction.payload_walletReference_milestoneTransactionPath!,
  );
  const milestoneTransaction = (await database().doc(col, colId, subCol, subColId).get())!;
  const collectionOutputId = Utils.computeOutputId(
    Utils.transactionId(milestoneTransaction.payload as unknown as TransactionPayload),
    1,
  );
  const collectionId = Utils.computeNftId(collectionOutputId);

  const batch = database().batch();

  const collectionDocRef = database().doc(COL.COLLECTION, transaction.payload_collection!);
  batch.update(collectionDocRef, {
    mintingData_address: transaction.payload_targetAddress,
    mintingData_network: transaction.network,
    mintingData_mintedOn: dayjs().toDate(),
    mintingData_mintedBy: transaction.member,
    mintingData_blockId: milestoneTransaction.blockId as string,
    mintingData_nftId: collectionId,
    mintingData_storageDeposit: transaction.payload_collectionOutputAmount,
    mintingData_aliasBlockId: transaction.payload_aliasBlockId,
    mintingData_aliasId: transaction.payload_aliasId,
  });

  const order = (await database().doc(COL.TRANSACTION, transaction.payload_orderId!).get())!;

  const nft = createMetadataNft(
    getProject(transaction),
    transaction.member!,
    transaction.space!,
    transaction.payload_collection!,
    order.payload.metadata || {},
  );
  const nftDocRef = database().doc(COL.NFT, nft.uid);
  batch.create(nftDocRef, nft);

  const space = await database().doc(COL.SPACE, transaction.space!).get();

  const nftMintOrder = createMintMetadataNftOrder(
    transaction,
    nft,
    space?.alias?.address!,
    collectionId,
    transaction.payload_orderId!,
  );
  const nftMintOrderDocRef = database().doc(COL.TRANSACTION, nftMintOrder.uid);
  batch.create(nftMintOrderDocRef, nftMintOrder);

  await batch.commit();
};

const onNftMinted = async (transaction: PgTransaction) => {
  const { col, colId, subCol, subColId } = getPathParts(
    transaction.payload_walletReference_milestoneTransactionPath!,
  );
  const milestoneTransaction = (await database().doc(col, colId, subCol, subColId).get())!;
  const nftOutputId = Utils.computeOutputId(
    Utils.transactionId(milestoneTransaction.payload as unknown as TransactionPayload),
    2,
  );
  const nftId = Utils.computeNftId(nftOutputId);

  const batch = database().batch();

  const nftDocRef = database().doc(COL.NFT, transaction.payload_nft!);
  const nft = await nftDocRef.get();
  batch.update(nftDocRef, {
    status: NftStatus.MINTED,
    mintingData_address: transaction.payload_targetAddress,
    mintingData_network: transaction.network,
    mintingData_mintedOn: dayjs().toDate(),
    mintingData_mintedBy: transaction.member,
    mintingData_blockId: milestoneTransaction.blockId as string,
    mintingData_nftId: nftId,
  });

  const orderDocRef = database().doc(COL.TRANSACTION, transaction.payload_orderId!);
  const order = <Transaction>await orderDocRef.get();

  const storageDepositTotal =
    (order.payload.aliasOutputAmount || 0) +
    (order.payload.collectionOutputAmount || 0) +
    (order.payload.nftOutputAmount || 0);

  const member = await database().doc(COL.MEMBER, transaction.member!).get();
  const collection = await database().doc(COL.COLLECTION, nft?.collection!).get();
  const space = await database().doc(COL.SPACE, collection?.space!).get();

  const remainder = order.payload.amount! - storageDepositTotal;

  if (remainder) {
    const creditTransaction: Transaction = {
      project: getProject(order),
      type: TransactionType.CREDIT,
      uid: getRandomEthAddress(),
      space: transaction.space,
      member: transaction.member,
      network: order.network,
      payload: {
        type: TransactionPayloadType.MINT_METADATA_NFT,
        amount: remainder,
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
    const creditDocRef = database().doc(COL.TRANSACTION, creditTransaction.uid);
    batch.create(creditDocRef, creditTransaction);
  }

  await batch.commit();
};

const onNftUpdated = async (transaction: PgTransaction) => {
  const batch = database().batch();

  const orderDocRef = database().doc(COL.TRANSACTION, transaction.payload_orderId!);
  const order = <Transaction>await orderDocRef.get();

  const nftDocRef = database().doc(COL.NFT, transaction.payload_nft!);
  const nft = await nftDocRef.get();
  batch.update(nftDocRef, { properties: JSON.stringify(order.payload.metadata) });

  const network = transaction.network as Network;
  const wallet = await WalletService.newWallet(network!);
  const { amount: balance } = await wallet.getBalance(order.payload.targetAddress!);

  const member = await database().doc(COL.MEMBER, transaction.member!).get();
  const collection = await database().doc(COL.COLLECTION, nft?.collection!).get();
  const space = await database().doc(COL.SPACE, collection?.space!).get();

  if (Number(balance)) {
    const creditTransaction: Transaction = {
      project: getProject(order),
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
    const creditDocRef = database().doc(COL.TRANSACTION, creditTransaction.uid);
    batch.create(creditDocRef, creditTransaction);
  }

  await batch.commit();
};
