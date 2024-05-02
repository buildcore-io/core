import { PgCollection, PgNftUpdate, database } from '@buildcore/database';
import {
  COL,
  CollectionStatus,
  DEFAULT_NETWORK,
  MediaStatus,
  Network,
  Nft,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  UnsoldMintingOptions,
} from '@buildcore/interfaces';
import { last } from 'lodash';
import { getAddress } from '../utils/address.utils';
import { collectionToIpfsMetadata, downloadMediaAndPackCar } from '../utils/car.utils';
import { getProject } from '../utils/common.utils';
import { logger } from '../utils/logger';
import { getRandomEthAddress } from '../utils/wallet.utils';
import { PgDocEvent } from './common';

export const onCollectionUpdated = async (event: PgDocEvent<PgCollection>) => {
  const { prev, curr } = event;
  if (!prev || !curr) {
    return;
  }
  try {
    if (prev && (curr.approved !== prev.approved || curr.rejected !== prev.rejected)) {
      return await updateNftApprovalState(curr.uid, curr.approved || false, curr.rejected || false);
    }

    if (curr.placeholderNft && prev.availableNfts !== curr.availableNfts) {
      return await hidePlaceholderNft(curr);
    }

    if (prev.mintingData_nftsToMint !== 0 && curr.mintingData_nftsToMint === 0) {
      return await onCollectionMinted(curr);
    }

    if (prev.status !== curr.status && curr.status === CollectionStatus.MINTING) {
      return await onCollectionMinting(curr);
    }
    if (
      curr.status === CollectionStatus.MINTING &&
      prev.mintingData_nftMediaToPrepare &&
      curr.mintingData_nftMediaToPrepare === 0
    ) {
      return await onNftMediaPrepared(curr);
    }
  } catch (error) {
    logger.error('onCollectionUpdated-error', curr.uid, error);
  }
};

const updateNftApprovalState = (collectionId: string, approved: boolean, rejected: boolean) =>
  database().collection(COL.NFT).update({ approved, rejected }, { collection: collectionId });

const hidePlaceholderNft = async (collection: PgCollection) => {
  const nftDocRef = database().doc(COL.NFT, collection.placeholderNft!);
  await nftDocRef.update({ hidden: collection.availableNfts === 0 });
};

const onCollectionMinted = async (collection: PgCollection) => {
  const network = collection.mintingData_network as Network;
  if (collection.limitedEdition) {
    const order: Transaction = {
      project: getProject(collection),
      type: TransactionType.MINT_COLLECTION,
      uid: getRandomEthAddress(),
      member: collection.mintingData_mintedBy,
      space: collection.space,
      network,
      payload: {
        type: TransactionPayloadType.LOCK_COLLECTION,
        amount: 0,
        sourceAddress: collection.mintingData_address,
        collection: collection.uid,
        aliasStorageDeposit: collection.mintingData_aliasStorageDeposit || 0,
      },
    };
    await database().doc(COL.TRANSACTION, order.uid).create(order);
    return;
  }
  const memberDocRef = database().doc(COL.MEMBER, collection.mintingData_mintedBy!);
  const member = (await memberDocRef.get())!;
  const order: Transaction = {
    project: getProject(collection),
    type: TransactionType.MINT_COLLECTION,
    uid: getRandomEthAddress(),
    member: collection.mintingData_mintedBy,
    space: collection.space,
    network,
    payload: {
      type: TransactionPayloadType.SEND_ALIAS_TO_GUARDIAN,
      amount: collection.mintingData_aliasStorageDeposit,
      sourceAddress: collection.mintingData_address,
      targetAddress: getAddress(member, network),
      collection: collection.uid,
      lockCollectionNft: collection.limitedEdition || false,
    },
  };
  await database().doc(COL.TRANSACTION, order.uid).create(order);
};

const onCollectionMinting = async (collection: PgCollection) => {
  await database().doc(COL.COLLECTION, collection.uid).update({
    mintingData_nftsToMint: null,
    mintingData_nftMediaToUpload: null,
    mintingData_nftMediaToPrepare: null,
  });

  const metadata = collectionToIpfsMetadata(collection);
  const ipfs = await downloadMediaAndPackCar(collection.uid, collection.bannerUrl!, metadata);
  await updateNftsForMinting(collection);

  await database().doc(COL.COLLECTION, collection.uid).update({
    mediaStatus: MediaStatus.PENDING_UPLOAD,
    ipfsMedia: ipfs.ipfsMedia,
    ipfsMetadata: ipfs.ipfsMetadata,
    ipfsRoot: ipfs.ipfsRoot,
  });
};

const onNftMediaPrepared = async (collection: PgCollection) => {
  const order: Transaction = {
    project: getProject(collection),
    type: TransactionType.MINT_COLLECTION,
    uid: getRandomEthAddress(),
    member: collection.mintingData_mintedBy!,
    space: collection.space,
    network: collection.mintingData_network as Network,
    payload: {
      type: TransactionPayloadType.MINT_ALIAS,
      amount: collection.mintingData_aliasStorageDeposit || 0,
      sourceAddress: collection.mintingData_address,
      collection: collection.uid,
      collectionStorageDeposit: collection.mintingData_storageDeposit,
    },
  };
  await database().doc(COL.TRANSACTION, order.uid).create(order);
};

const BATCH_SIZE = 1000;
const updateNftsForMinting = async (collection: PgCollection) => {
  const collectionDocRef = database().doc(COL.COLLECTION, collection.uid);
  const unsoldMintingOptions = collection.mintingData_unsoldMintingOptions;
  let unsoldCount = 0;
  let nftsToMintCount = 0;
  let nftMediaToUploadCount = 0;
  let nftMediaToPrepareCount = 0;

  if (unsoldMintingOptions === UnsoldMintingOptions.BURN_UNSOLD) {
    const deleted = await database()
      .collection(COL.NFT)
      .delete({ collection: collection.uid, sold: false, placeholderNft: false });
    if (deleted) {
      await database()
        .doc(COL.COLLECTION, collection.uid)
        .update({ total: database().inc(-deleted) });
    }
  }

  let lastDoc: Nft | undefined = undefined;
  do {
    const allNfts: Nft[] = await database()
      .collection(COL.NFT)
      .where('collection', '==', collection.uid)
      .where('placeholderNft', '==', false)
      .startAfter(lastDoc)
      .limit(BATCH_SIZE)
      .get();
    lastDoc = last(allNfts);

    const unsold = allNfts.filter((nft) => !nft.sold);

    const nftsToMint =
      unsoldMintingOptions === UnsoldMintingOptions.BURN_UNSOLD
        ? allNfts.filter((nft) => nft.sold)
        : allNfts;

    nftsToMintCount += nftsToMint.length;
    nftMediaToUploadCount += nftsToMint.length;
    nftMediaToPrepareCount += nftsToMint.length;

    const promises = nftsToMint.map((nft) => setNftForMinting(nft.uid, collection));
    const nftMediaStatuses = await Promise.all(promises);
    const nftMediaAlreadyUploaded = nftMediaStatuses.filter(
      (s) => s === MediaStatus.UPLOADED,
    ).length;
    const nftMediaAlreadyPrepared = nftMediaStatuses.filter((s) =>
      [MediaStatus.UPLOADED, MediaStatus.PENDING_UPLOAD].includes(s),
    ).length;

    nftMediaToUploadCount -= nftMediaAlreadyUploaded;
    nftMediaToPrepareCount -= nftMediaAlreadyPrepared;

    unsoldCount += unsold.length;
  } while (lastDoc);

  await collectionDocRef.update({
    mintingData_nftsToMint: database().inc(nftsToMintCount),
    mintingData_nftMediaToUpload: database().inc(nftMediaToUploadCount),
    mintingData_nftMediaToPrepare: database().inc(nftMediaToPrepareCount),
  });

  if (
    !unsoldCount ||
    UnsoldMintingOptions.BURN_UNSOLD === unsoldMintingOptions ||
    UnsoldMintingOptions.TAKE_OWNERSHIP === unsoldMintingOptions
  ) {
    const promises = (
      await database()
        .collection(COL.NFT)
        .where('collection', '==', collection.uid)
        .where('placeholderNft', '==', true)
        .get()
    ).map(async (nft) => {
      const docRef = database().doc(COL.NFT, nft.uid);
      await docRef.update({ hidden: true });
    });
    await Promise.all(promises);
  }
  if (unsoldCount && unsoldMintingOptions === UnsoldMintingOptions.TAKE_OWNERSHIP) {
    await collectionDocRef.update({ sold: database().inc(unsoldCount) });
  }

  // Update placeholder
  if (
    unsoldCount &&
    collection.placeholderNft &&
    collection.mintingData_unsoldMintingOptions === UnsoldMintingOptions.SET_NEW_PRICE
  ) {
    await database()
      .doc(COL.NFT, collection.placeholderNft)
      .update({
        availablePrice: collection.mintingData_newPrice || collection.price,
        price: collection.mintingData_newPrice || collection.price,
      });
  }
};

const setNftForMinting = async (nftId: string, collection: PgCollection): Promise<MediaStatus> => {
  const nft = await database().runTransaction(async (transaction) => {
    const nftDocRef = database().doc(COL.NFT, nftId);
    const nft = (await transaction.get(nftDocRef))!;

    if (nft.mediaStatus === MediaStatus.PREPARE_IPFS) {
      await transaction.update(nftDocRef, { mediaStatus: MediaStatus.ERROR });
    }

    const nftUpdateData = <PgNftUpdate>{
      auctionFrom: null,
      auctionTo: null,
      extendedAuctionTo: null,
      auctionFloorPrice: null,
      auctionLength: null,
      extendedAuctionLength: null,
      auctionHighestBid: null,
      auctionHighestBidder: null,
      auction: null,
      mediaStatus:
        nft.mediaStatus === MediaStatus.PREPARE_IPFS
          ? MediaStatus.ERROR
          : nft.mediaStatus || MediaStatus.PREPARE_IPFS,
    };

    if (nft.auction) {
      const auctionDocRef = database().doc(COL.AUCTION, nft.auction);
      await transaction.update(auctionDocRef, { active: false });

      const payments = await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.PAYMENT)
        .where('payload_invalidPayment', '==', false)
        .where('payload_auction', '==', nft.auction)
        .get();
      for (const payment of payments) {
        const credit: Transaction = {
          project: getProject(payment),
          type: TransactionType.CREDIT,
          uid: getRandomEthAddress(),
          space: payment.space,
          member: payment.member,
          network: payment.network || DEFAULT_NETWORK,
          payload: {
            amount: payment.payload.amount,
            sourceAddress: payment.payload.targetAddress,
            targetAddress: payment.payload.sourceAddress,
            sourceTransaction: [payment.uid],
            nft: nft.uid,
            collection: nft.collection,
          },
        };
        const creditDocRef = database().doc(COL.TRANSACTION, credit.uid);
        await transaction.create(creditDocRef, credit);
      }
    }

    if (nft.locked) {
      const docRef = database().doc(COL.TRANSACTION, nft.lockedBy!);
      await transaction.update(docRef, { payload_void: true });
      nftUpdateData.locked = false;
      nftUpdateData.lockedBy = null;
    }

    if (nft.sold) {
      nftUpdateData.availableFrom = null;
      nftUpdateData.availablePrice = null;
      nftUpdateData.price = 0;
    } else {
      if (collection.mintingData_unsoldMintingOptions === UnsoldMintingOptions.SET_NEW_PRICE) {
        nftUpdateData.availablePrice =
          collection.mintingData_newPrice || nftUpdateData.availablePrice;
        nftUpdateData.price = collection.mintingData_newPrice || nftUpdateData.price;
      }
      if (collection.mintingData_unsoldMintingOptions === UnsoldMintingOptions.TAKE_OWNERSHIP) {
        nftUpdateData.owner = collection.mintingData_mintedBy!;
        nftUpdateData.isOwned = true;
        nftUpdateData.sold = true;
        nftUpdateData.availableFrom = null;
        nftUpdateData.availablePrice = null;
        nftUpdateData.price = 0;
      }
    }
    await transaction.update(nftDocRef, nftUpdateData);

    return nftUpdateData;
  });

  if (nft.mediaStatus === MediaStatus.ERROR) {
    const nftDocRef = database().doc(COL.NFT, nftId);
    await nftDocRef.update({ mediaStatus: MediaStatus.PREPARE_IPFS });
  }

  return nft.mediaStatus as MediaStatus;
};
