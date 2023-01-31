import { COL, Collection, MediaStatus, Nft, NftAvailable, WEN_FUNC } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import admin, { inc } from '../admin.config';
import { scale } from '../scale.settings';
import { downloadMediaAndPackCar, nftToIpfsMetadata } from '../utils/car.utils';
import { uOn } from '../utils/dateTime.utils';

const getNftAvailability = (nft: Nft | undefined) => {
  if (!nft) {
    return NftAvailable.UNAVAILABLE;
  }
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

    const prevAvailability = getNftAvailability(prev);
    const currAvailability = getNftAvailability(curr);
    if (prevAvailability !== currAvailability) {
      await updateCollectionStatsOnAvailabilityChange(
        prevAvailability,
        currAvailability,
        curr.collection,
      );
      await change.after.ref.update(uOn({ available: currAvailability }));
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

const updateCollectionStatsOnAvailabilityChange = async (
  prev: NftAvailable,
  curr: NftAvailable,
  collection: string,
) => {
  const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collection}`);
  let availableNfts = 0;
  let nftsOnAuction = 0;

  if (prev === NftAvailable.UNAVAILABLE) {
    availableNfts = [NftAvailable.SALE, NftAvailable.AUCTION_AND_SALE].includes(curr) ? 1 : 0;
    nftsOnAuction = [NftAvailable.AUCTION, NftAvailable.AUCTION_AND_SALE].includes(curr) ? 1 : 0;
  } else if (prev === NftAvailable.SALE) {
    availableNfts = [NftAvailable.UNAVAILABLE, NftAvailable.AUCTION].includes(curr) ? -1 : 0;
    nftsOnAuction = [NftAvailable.AUCTION, NftAvailable.AUCTION_AND_SALE].includes(curr) ? 1 : 0;
  } else if (prev === NftAvailable.AUCTION) {
    nftsOnAuction = curr === NftAvailable.UNAVAILABLE ? -1 : 0;
  } else if (prev === NftAvailable.AUCTION_AND_SALE) {
    availableNfts = curr === NftAvailable.UNAVAILABLE ? -1 : 0;
    nftsOnAuction = curr === NftAvailable.UNAVAILABLE ? -1 : 0;
  }

  await collectionDocRef.update(
    uOn({
      availableNfts: inc(availableNfts),
      nftsOnAuction: inc(nftsOnAuction),
    }),
  );
};
