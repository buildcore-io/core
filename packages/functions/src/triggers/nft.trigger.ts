import { COL, Collection, MediaStatus, Nft, NftAvailable, WEN_FUNC } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import admin, { inc } from '../admin.config';
import { scale } from '../scale.settings';
import { downloadMediaAndPackCar, nftToIpfsMetadata } from '../utils/car.utils';
import { uOn } from '../utils/dateTime.utils';

const getNftAvailability = (nft: Nft) => {
  if (nft.availableFrom && nft.auctionFrom) {
    return NftAvailable.AUCTION_AND_SALE;
  }
  if (nft.availableFrom && !nft.auctionFrom) {
    return NftAvailable.SALE;
  }
  if (!nft.availableFrom && nft.auctionFrom) {
    return NftAvailable.AUCTION;
  }
  return NftAvailable.UNAVAILABLE;
};

export const nftWrite = functions
  .runWith({
    minInstances: scale(WEN_FUNC.nftWrite),
    timeoutSeconds: 540,
    memory: '512MB',
  })
  .firestore.document(COL.NFT + '/{nftId}')
  .onWrite(async (change) => {
    const prev = <Nft | undefined>change.before.data();
    const curr = <Nft | undefined>change.after.data();
    if (!curr) {
      return;
    }

    if (prev?.availableFrom !== curr.availableFrom || prev.auctionFrom !== curr.auctionFrom) {
      await change.after.ref.update(uOn({ available: getNftAvailability(curr) }));
    }

    if (prev?.mediaStatus !== curr.mediaStatus && curr.mediaStatus === MediaStatus.PREPARE_IPFS) {
      await prepareNftMedia(curr);
    }
  });

const prepareNftMedia = async (nft: Nft) => {
  const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${nft.collection}`);
  const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
  const batch = admin.firestore().batch();

  if (nft.ipfsRoot) {
    batch.update(nftDocRef, uOn({ mediaStatus: MediaStatus.PENDING_UPLOAD }));
  } else {
    const collection = <Collection>(await collectionDocRef.get()).data();
    const metadata = nftToIpfsMetadata(collection, nft);
    const ipfs = await downloadMediaAndPackCar(nft.uid, nft.media, metadata);
    batch.update(
      nftDocRef,
      uOn({
        mediaStatus: MediaStatus.PENDING_UPLOAD,
        ipfsMedia: ipfs.ipfsMedia,
        ipfsMetadata: ipfs.ipfsMetadata,
        ipfsRoot: ipfs.ipfsRoot,
      }),
    );
  }

  batch.update(collectionDocRef, uOn({ 'mintingData.nftMediaToPrepare': inc(-1) }));
  await batch.commit();
};
