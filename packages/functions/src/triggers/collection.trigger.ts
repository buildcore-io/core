import {
  COL,
  Collection,
  CollectionStatus,
  DEFAULT_NETWORK,
  MediaStatus,
  Member,
  Nft,
  Transaction,
  TransactionMintCollectionType,
  TransactionType,
  UnsoldMintingOptions,
  WEN_FUNC_TRIGGER,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions/v2';
import { last } from 'lodash';
import { getSnapshot, soonDb } from '../firebase/firestore/soondb';
import { scale } from '../scale.settings';
import { getAddress } from '../utils/address.utils';
import { collectionToIpfsMetadata, downloadMediaAndPackCar } from '../utils/car.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

export const collectionWrite = functions.firestore.onDocumentUpdated(
  {
    document: COL.COLLECTION + '/{collectionId}',
    timeoutSeconds: 540,
    minInstances: scale(WEN_FUNC_TRIGGER.collectionWrite),
    memory: '1GiB',
  },
  async (event) => {
    const prev = <Collection>event.data?.before?.data();
    const curr = <Collection>event.data?.after?.data();
    if (!curr) {
      return;
    }
    try {
      if (prev && (curr.approved !== prev.approved || curr.rejected !== prev.rejected)) {
        return await updateNftApprovalState(curr.uid);
      }

      if (curr.placeholderNft && prev.availableNfts !== curr.availableNfts) {
        return await hidePlaceholderNft(curr);
      }

      if (prev.mintingData?.nftsToMint !== 0 && curr.mintingData?.nftsToMint === 0) {
        return await onCollectionMinted(curr);
      }

      if (prev.status !== curr.status && curr.status === CollectionStatus.MINTING) {
        return await onCollectionMinting(curr);
      }
      if (
        curr.status === CollectionStatus.MINTING &&
        prev.mintingData?.nftMediaToPrepare &&
        curr.mintingData?.nftMediaToPrepare === 0
      ) {
        return await onNftMediaPrepared(curr);
      }
    } catch (error) {
      functions.logger.error(curr.uid, error);
    }
  },
);

const updateNftApprovalState = async (collectionId: string) => {
  let lastDocId = '';
  do {
    const lastDoc = await getSnapshot(COL.NFT, lastDocId);
    const snap = await soonDb()
      .collection(COL.NFT)
      .where('collection', '==', collectionId)
      .startAfter(lastDoc)
      .limit(500)
      .get<Nft>();
    lastDocId = last(snap)?.uid || '';

    await soonDb().runTransaction(async (transaction) => {
      const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${collectionId}`);
      const collection = await transaction.get<Collection>(collectionDocRef);

      snap.forEach((nft) => {
        const nftDocRef = soonDb().doc(`${COL.NFT}/${nft.uid}`);
        transaction.update(nftDocRef, {
          approved: collection?.approved || false,
          rejected: collection?.rejected || false,
        });
      });
    });
  } while (lastDocId);
};

const hidePlaceholderNft = async (collection: Collection) => {
  const nftDocRef = soonDb().doc(`${COL.NFT}/${collection.placeholderNft}`);
  await nftDocRef.update({ hidden: collection.availableNfts === 0 });
};

const onCollectionMinted = async (collection: Collection) => {
  if (collection.limitedEdition) {
    const order = <Transaction>{
      type: TransactionType.MINT_COLLECTION,
      uid: getRandomEthAddress(),
      member: collection.mintingData?.mintedBy,
      space: collection.space,
      network: collection.mintingData?.network,
      payload: {
        type: TransactionMintCollectionType.LOCK_COLLECTION,
        amount: 0,
        sourceAddress: collection.mintingData?.address,
        collection: collection.uid,
        aliasStorageDeposit: collection.mintingData?.aliasStorageDeposit || 0,
      },
    };
    await soonDb().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
    return;
  }
  const memberDocRef = soonDb().doc(`${COL.MEMBER}/${collection.mintingData?.mintedBy}`);
  const member = (await memberDocRef.get<Member>())!;
  const order = <Transaction>{
    type: TransactionType.MINT_COLLECTION,
    uid: getRandomEthAddress(),
    member: collection.mintingData?.mintedBy,
    space: collection.space,
    network: collection.mintingData?.network,
    payload: {
      type: TransactionMintCollectionType.SEND_ALIAS_TO_GUARDIAN,
      amount: collection.mintingData?.aliasStorageDeposit,
      sourceAddress: collection.mintingData?.address,
      targetAddress: getAddress(member, collection.mintingData?.network!),
      collection: collection.uid,
      lockCollectionNft: collection.limitedEdition || false,
    },
  };
  await soonDb().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
};

const onCollectionMinting = async (collection: Collection) => {
  await soonDb().doc(`${COL.COLLECTION}/${collection.uid}`).update({
    'mintingData.nftsToMint': soonDb().deleteField(),
    'mintingData.nftMediaToUpload': soonDb().deleteField(),
    'mintingData.nftMediaToPrepare': soonDb().deleteField(),
  });

  const metadata = collectionToIpfsMetadata(collection);
  const ipfs = await downloadMediaAndPackCar(collection.uid, collection.bannerUrl, metadata);
  await updateNftsForMinting(collection);

  await soonDb().doc(`${COL.COLLECTION}/${collection.uid}`).update({
    mediaStatus: MediaStatus.PENDING_UPLOAD,
    ipfsMedia: ipfs.ipfsMedia,
    ipfsMetadata: ipfs.ipfsMetadata,
    ipfsRoot: ipfs.ipfsRoot,
  });
};

const onNftMediaPrepared = async (collection: Collection) => {
  const order = <Transaction>{
    type: TransactionType.MINT_COLLECTION,
    uid: getRandomEthAddress(),
    member: collection.mintingData?.mintedBy!,
    space: collection.space,
    network: collection.mintingData?.network,
    payload: {
      type: TransactionMintCollectionType.MINT_ALIAS,
      amount: collection.mintingData?.aliasStorageDeposit || 0,
      sourceAddress: collection.mintingData?.address,
      collection: collection.uid,
      collectionStorageDeposit: collection.mintingData?.storageDeposit,
    },
  };
  await soonDb().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
};

const BATCH_SIZE = 1000;
const updateNftsForMinting = async (collection: Collection) => {
  const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${collection.uid}`);
  const unsoldMintingOptions = collection.mintingData?.unsoldMintingOptions;
  let lastDocId = '';
  let unsoldCount = 0;
  let nftsToMintCount = 0;
  let nftMediaToUploadCount = 0;
  let nftMediaToPrepareCount = 0;

  do {
    const lastDoc = await getSnapshot(COL.NFT, lastDocId);
    const allNfts = await soonDb()
      .collection(COL.NFT)
      .where('collection', '==', collection.uid)
      .where('placeholderNft', '==', false)
      .startAfter(lastDoc)
      .limit(BATCH_SIZE)
      .get<Nft>();
    lastDocId = last(allNfts)?.uid || '';

    const unsold = allNfts.filter((nft) => !nft.sold);
    if (unsoldMintingOptions === UnsoldMintingOptions.BURN_UNSOLD) {
      const promises = unsold.map((nft) => soonDb().doc(`${COL.NFT}/${nft.uid}`).delete());
      await Promise.all(promises);
      await soonDb()
        .doc(`${COL.COLLECTION}/${collection.uid}`)
        .update({ total: soonDb().inc(-unsold.length) });
    }
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
  } while (lastDocId);

  await collectionDocRef.update({
    'mintingData.nftsToMint': soonDb().inc(nftsToMintCount),
    'mintingData.nftMediaToUpload': soonDb().inc(nftMediaToUploadCount),
    'mintingData.nftMediaToPrepare': soonDb().inc(nftMediaToPrepareCount),
  });

  if (
    !unsoldCount ||
    [UnsoldMintingOptions.BURN_UNSOLD, UnsoldMintingOptions.TAKE_OWNERSHIP].includes(
      unsoldMintingOptions!,
    )
  ) {
    const promises = (
      await soonDb()
        .collection(COL.NFT)
        .where('collection', '==', collection.uid)
        .where('placeholderNft', '==', true)
        .get<Nft>()
    ).map((nft) => {
      const docRef = soonDb().doc(`${COL.NFT}/${nft.uid}`);
      docRef.update({ hidden: true });
    });
    await Promise.all(promises);
  }
  if (unsoldCount && unsoldMintingOptions === UnsoldMintingOptions.TAKE_OWNERSHIP) {
    await collectionDocRef.update({ sold: soonDb().inc(unsoldCount) });
  }

  // Update placeholder
  if (
    unsoldCount &&
    collection.placeholderNft &&
    collection.mintingData?.unsoldMintingOptions === UnsoldMintingOptions.SET_NEW_PRICE
  ) {
    await soonDb()
      .doc(`${COL.NFT}/${collection.placeholderNft}`)
      .update({
        availablePrice: collection.mintingData?.newPrice || collection.price,
        price: collection.mintingData?.newPrice || collection.price,
      });
  }
};

const setNftForMinting = async (nftId: string, collection: Collection): Promise<MediaStatus> => {
  const nftDocRef = soonDb().doc(`${COL.NFT}/${nftId}`);

  const nft = await soonDb().runTransaction(async (transaction) => {
    const nft = (await transaction.get<Nft>(nftDocRef))!;

    if (nft.mediaStatus === MediaStatus.PREPARE_IPFS) {
      transaction.update(nftDocRef, { mediaStatus: MediaStatus.ERROR });
    }

    const nftUpdateData = <Nft>{
      auctionFrom: null,
      auctionTo: null,
      auctionFloorPrice: null,
      auctionLength: null,
      auctionHighestBid: null,
      auctionHighestBidder: null,
      auctionHighestTransaction: null,
      mediaStatus:
        nft.mediaStatus === MediaStatus.PREPARE_IPFS
          ? MediaStatus.ERROR
          : nft.mediaStatus || MediaStatus.PREPARE_IPFS,
    };

    if (nft.auctionHighestTransaction) {
      const highestTransaction = <Transaction>(
        await soonDb().doc(`${COL.TRANSACTION}/${nft.auctionHighestTransaction}`).get()
      );
      const member = <Member>await soonDb().doc(`${COL.MEMBER}/${nft.auctionHighestBidder}`).get();
      const credit = <Transaction>{
        type: TransactionType.CREDIT,
        uid: getRandomEthAddress(),
        space: highestTransaction.space,
        member: highestTransaction.member,
        network: highestTransaction.network || DEFAULT_NETWORK,
        payload: {
          amount: highestTransaction.payload.amount,
          sourceAddress: highestTransaction.payload.targetAddress,
          targetAddress: getAddress(member, highestTransaction.network || DEFAULT_NETWORK),
          sourceTransaction: [highestTransaction.uid],
          nft: nft.uid,
          collection: nft.collection,
        },
      };
      transaction.create(soonDb().doc(`${COL.TRANSACTION}/${credit.uid}`), credit);
    }

    if (nft.locked) {
      transaction.update(soonDb().doc(`${COL.TRANSACTION}/${nft.lockedBy}`), {
        'payload.void': true,
      });
      nftUpdateData.locked = false;
      nftUpdateData.lockedBy = null;
    }

    if (nft.sold) {
      nftUpdateData.availableFrom = null;
      nftUpdateData.availablePrice = null;
      nftUpdateData.price = 0;
    } else {
      if (collection.mintingData?.unsoldMintingOptions === UnsoldMintingOptions.SET_NEW_PRICE) {
        nftUpdateData.availablePrice =
          collection.mintingData?.newPrice || nftUpdateData.availablePrice;
        nftUpdateData.price = collection.mintingData?.newPrice || nftUpdateData.price;
      }
      if (collection.mintingData?.unsoldMintingOptions === UnsoldMintingOptions.TAKE_OWNERSHIP) {
        nftUpdateData.owner = collection.mintingData?.mintedBy!;
        nftUpdateData.isOwned = true;
        nftUpdateData.sold = true;
        nftUpdateData.availableFrom = null;
        nftUpdateData.availablePrice = null;
        nftUpdateData.price = 0;
      }
    }
    transaction.update(nftDocRef, nftUpdateData);

    return nftUpdateData;
  });

  if (nft.mediaStatus === MediaStatus.ERROR) {
    await nftDocRef.update({ mediaStatus: MediaStatus.PREPARE_IPFS });
  }

  return nft.mediaStatus!;
};
