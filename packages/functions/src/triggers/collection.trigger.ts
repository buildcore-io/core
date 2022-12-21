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
  URL_PATHS,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { last } from 'lodash';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { getAddress } from '../utils/address.utils';
import {
  collectionToIpfsMetadata,
  downloadMediaAndPackCar,
  nftToIpfsMetadata,
} from '../utils/car.utils';
import { LastDocType } from '../utils/common.utils';
import { cOn, uOn } from '../utils/dateTime.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

export const collectionWrite = functions
  .runWith({
    timeoutSeconds: 300,
    minInstances: scale(WEN_FUNC.collectionWrite),
    memory: '2GB',
  })
  .firestore.document(COL.COLLECTION + '/{collectionId}')
  .onUpdate(async (change) => {
    const prev = <Collection>change.before.data();
    const curr = <Collection>change.after.data();
    if (!curr) {
      return;
    }
    try {
      if (curr.approved !== prev.approved || curr.rejected !== prev.rejected) {
        return await updateNftApprovalState(curr.uid);
      }

      if (prev.mintingData?.nftsToMint !== 0 && curr.mintingData?.nftsToMint === 0) {
        return await onCollectionMinted(curr);
      }

      if (prev.status !== curr.status && curr.status === CollectionStatus.MINTING) {
        return await onCollectionMinting(curr);
      }
    } catch (error) {
      functions.logger.error(curr.uid, error);
    }
  });

const updateNftApprovalState = async (collectionId: string) => {
  let lastDoc: LastDocType | undefined = undefined;
  do {
    let query = admin
      .firestore()
      .collection(COL.NFT)
      .where('collection', '==', collectionId)
      .limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();

    await admin.firestore().runTransaction(async (transaction) => {
      const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collectionId}`);
      const collection = <Collection | undefined>(await transaction.get(collectionDocRef)).data();

      snap.docs.forEach((doc) => {
        transaction.update(
          doc.ref,
          uOn({
            approved: collection?.approved || false,
            rejected: collection?.rejected || false,
          }),
        );
      });
    });
    lastDoc = last(snap.docs);
  } while (lastDoc);
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
    await admin
      .firestore()
      .doc(`${COL.TRANSACTION}/${order.uid}`)
      .create(cOn(order, URL_PATHS.TRANSACTION));
    return;
  }
  const member = <Member>(
    (await admin.firestore().doc(`${COL.MEMBER}/${collection.mintingData?.mintedBy}`).get()).data()
  );
  const order = <Transaction>{
    type: TransactionType.MINT_COLLECTION,
    uid: getRandomEthAddress(),
    member: collection.mintingData?.mintedBy,
    space: collection.space,
    network: collection.mintingData?.network,
    payload: {
      type: TransactionMintCollectionType.SENT_ALIAS_TO_GUARDIAN,
      amount: collection.mintingData?.aliasStorageDeposit,
      sourceAddress: collection.mintingData?.address,
      targetAddress: getAddress(member, collection.mintingData?.network!),
      collection: collection.uid,
      lockCollectionNft: collection.limitedEdition || false,
    },
  };
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(cOn(order));
};

const onCollectionMinting = async (collection: Collection) => {
  const metadata = collectionToIpfsMetadata(collection);
  const ipfs = await downloadMediaAndPackCar(collection.uid, collection.bannerUrl, metadata);
  const nftsToMint = await updateNftsForMinting(collection);

  await admin
    .firestore()
    .doc(`${COL.COLLECTION}/${collection.uid}`)
    .update(
      uOn({
        'mintingData.nftsToMint': nftsToMint,
        mediaStatus: MediaStatus.PENDING_UPLOAD,
        'mintingData.nftMediaToUpload': nftsToMint,
        ipfsMedia: ipfs.ipfsMedia,
        ipfsMetadata: ipfs.ipfsMetadata,
        ipfsRoot: ipfs.ipfsRoot,
      }),
    );

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
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(cOn(order));
};

const BATCH_SIZE = 20;
const updateNftsForMinting = async (collection: Collection) => {
  const unsoldMintingOptions = collection.mintingData?.unsoldMintingOptions;
  let lastDoc: LastDocType | undefined = undefined;
  let nftsToMintCount = 0;
  let unsoldCount = 0;
  do {
    let query = admin
      .firestore()
      .collection(COL.NFT)
      .where('collection', '==', collection.uid)
      .where('placeholderNft', '==', false)
      .limit(BATCH_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    const allNfts = snap.docs.map((d) => <Nft>d.data());
    const unsold = allNfts.filter((nft) => !nft.sold);
    if (unsoldMintingOptions === UnsoldMintingOptions.BURN_UNSOLD) {
      const promises = unsold.map((nft) => admin.firestore().doc(`${COL.NFT}/${nft.uid}`).delete());
      await Promise.all(promises);
      await admin
        .firestore()
        .doc(`${COL.COLLECTION}/${collection.uid}`)
        .update(
          uOn({
            total: admin.firestore.FieldValue.increment(-unsold.length),
          }),
        );
    }
    const nftsToMint =
      unsoldMintingOptions === UnsoldMintingOptions.BURN_UNSOLD
        ? allNfts.filter((nft) => nft.sold)
        : allNfts;
    const promises = nftsToMint.map((nft) => setNftForMinting(nft.uid, collection));
    await Promise.all(promises);

    lastDoc = last(snap.docs);
    nftsToMintCount += nftsToMint.length;
    unsoldCount += unsold.length;
  } while (lastDoc !== undefined);

  if (
    !unsoldCount ||
    [UnsoldMintingOptions.BURN_UNSOLD, UnsoldMintingOptions.TAKE_OWNERSHIP].includes(
      unsoldMintingOptions!,
    )
  ) {
    const promises = (
      await admin
        .firestore()
        .collection(COL.NFT)
        .where('collection', '==', collection.uid)
        .where('placeholderNft', '==', true)
        .get()
    ).docs.map((d) => d.ref.update(uOn({ hidden: true })));
    await Promise.all(promises);
  }
  if (unsoldCount && unsoldMintingOptions === UnsoldMintingOptions.TAKE_OWNERSHIP) {
    await admin
      .firestore()
      .doc(`${COL.COLLECTION}/${collection.uid}`)
      .update(uOn({ sold: admin.firestore.FieldValue.increment(unsoldCount) }));
  }

  // Update placeholder
  if (
    unsoldCount &&
    collection.placeholderNft &&
    collection.mintingData?.unsoldMintingOptions === UnsoldMintingOptions.SET_NEW_PRICE
  ) {
    await admin
      .firestore()
      .doc(`${COL.NFT}/${collection.placeholderNft}`)
      .update(
        uOn({
          availablePrice: collection.mintingData?.newPrice || collection.price,
          price: collection.mintingData?.newPrice || collection.price,
        }),
      );
  }

  return nftsToMintCount;
};

const setNftForMinting = (nftId: string, collection: Collection) =>
  admin.firestore().runTransaction(async (transaction) => {
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nftId}`);
    const nft = <Nft>(await transaction.get(nftDocRef)).data();

    const metadata = nftToIpfsMetadata(collection, nft);
    const ipfs = await downloadMediaAndPackCar(nft.uid, nft.media, metadata);

    const nftUpdateData = <Nft>{
      auctionFrom: null,
      auctionTo: null,
      auctionFloorPrice: null,
      auctionLength: null,
      auctionHighestBid: null,
      auctionHighestBidder: null,
      auctionHighestTransaction: null,
      mediaStatus: MediaStatus.PENDING_UPLOAD,
      ipfsMedia: ipfs.ipfsMedia,
      ipfsMetadata: ipfs.ipfsMetadata,
      ipfsRoot: ipfs.ipfsRoot,
    };

    if (nft.auctionHighestTransaction) {
      const highestTransaction = <Transaction>(
        (
          await admin.firestore().doc(`${COL.TRANSACTION}/${nft.auctionHighestTransaction}`).get()
        ).data()
      );
      const member = <Member>(
        (await admin.firestore().doc(`${COL.MEMBER}/${nft.auctionHighestBidder}`).get()).data()
      );
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
      transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${credit.uid}`), cOn(credit));
    }

    if (nft.locked) {
      transaction.update(
        admin.firestore().doc(`${COL.TRANSACTION}/${nft.lockedBy}`),
        uOn({
          'payload.void': true,
        }),
      );
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
    transaction.update(nftDocRef, uOn(nftUpdateData));
  });
