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
    memory: '512MB'
  })
  .firestore.document(COL.NFT + '/{nftId}')
  .onWrite(async (change) => {
    const prev = <Nft | undefined>change.before.data();
    const curr = <Nft | undefined>change.after.data();
    if (!curr) {
      return;
    }
    await admin.firestore().runTransaction(async (transaction) => {
      const docRef = admin.firestore().doc(`${COL.NFT}/${curr.uid}`);
      const nft = <Nft>(await transaction.get(docRef)).data();
      const data = { available: getNftAvailability(nft), isOwned: nft.owner !== undefined };
      if (data.available !== nft.available || data.isOwned !== nft.isOwned) {
        transaction.update(docRef, uOn(data));
      }
    });

    if (prev?.mediaStatus !== curr.mediaStatus && curr.mediaStatus === MediaStatus.PREPARE_IPFS) {
      await prepareNftMedia(curr);
    }
  });

const prepareNftMedia = async (nft: Nft) => {
  const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${nft.collection}`);
  const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);

  const collection = <Collection>(await collectionDocRef.get()).data();

  const metadata = nftToIpfsMetadata(collection, nft);
  const ipfs = await downloadMediaAndPackCar(nft.uid, nft.media, metadata);

  const batch = admin.firestore().batch();
  batch.update(
    nftDocRef,
    uOn({
      mediaStatus: MediaStatus.PENDING_UPLOAD,
      ipfsMedia: ipfs.ipfsMedia,
      ipfsMetadata: ipfs.ipfsMetadata,
      ipfsRoot: ipfs.ipfsRoot,
    }),
  );
  batch.update(collectionDocRef, uOn({ 'mintingData.nftMediaToPrepare': inc(-1) }));
  await batch.commit();
};
