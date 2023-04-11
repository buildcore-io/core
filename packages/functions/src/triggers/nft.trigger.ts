import { COL, Collection, MediaStatus, Nft, NftAvailable, WEN_FUNC } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { soonDb } from '../firebase/firestore/soondb';
import { scale } from '../scale.settings';
import { downloadMediaAndPackCar, nftToIpfsMetadata } from '../utils/car.utils';

const getNftAvailability = (nft: Nft | undefined) => {
  if (!nft || nft.placeholderNft) {
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
      const { nftsOnSale, nftsOnAuction } = getSaleChanges(
        prevAvailability,
        currAvailability,
        prev?.owner,
      );
      const availableNfts = getAvailableNftsChange(prevAvailability, currAvailability, prev?.owner);

      const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${curr.collection}`);
      await collectionDocRef.update({
        nftsOnSale: soonDb().inc(nftsOnSale),
        nftsOnAuction: soonDb().inc(nftsOnAuction),
        availableNfts: soonDb().inc(availableNfts),
      });

      await change.after.ref.update({ available: currAvailability });
    }

    if (prev?.mediaStatus !== curr.mediaStatus && curr.mediaStatus === MediaStatus.PREPARE_IPFS) {
      await prepareNftMedia(curr);
    }
  });

const prepareNftMedia = async (nft: Nft) => {
  const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${nft.collection}`);
  const nftDocRef = soonDb().doc(`${COL.NFT}/${nft.uid}`);
  const batch = soonDb().batch();

  if (nft.ipfsRoot) {
    batch.update(nftDocRef, { mediaStatus: MediaStatus.PENDING_UPLOAD });
  } else {
    const collection = (await collectionDocRef.get<Collection>())!;
    const metadata = nftToIpfsMetadata(collection, nft);
    const ipfs = await downloadMediaAndPackCar(nft.uid, nft.media, metadata);
    batch.update(nftDocRef, {
      mediaStatus: MediaStatus.PENDING_UPLOAD,
      ipfsMedia: ipfs.ipfsMedia,
      ipfsMetadata: ipfs.ipfsMetadata,
      ipfsRoot: ipfs.ipfsRoot,
    });
  }

  batch.update(collectionDocRef, { 'mintingData.nftMediaToPrepare': soonDb().inc(-1) });
  await batch.commit();
};

const getSaleChanges = (prev: NftAvailable, curr: NftAvailable, owner = '') => {
  let nftsOnSale = 0;
  let nftsOnAuction = 0;

  if (!owner) {
    return { nftsOnSale, nftsOnAuction };
  }

  if (prev === NftAvailable.UNAVAILABLE) {
    nftsOnSale = [NftAvailable.SALE, NftAvailable.AUCTION_AND_SALE].includes(curr) ? 1 : 0;
    nftsOnAuction = [NftAvailable.AUCTION, NftAvailable.AUCTION_AND_SALE].includes(curr) ? 1 : 0;
  } else if (prev === NftAvailable.SALE) {
    nftsOnSale = [NftAvailable.UNAVAILABLE, NftAvailable.AUCTION].includes(curr) ? -1 : 0;
    nftsOnAuction = [NftAvailable.AUCTION, NftAvailable.AUCTION_AND_SALE].includes(curr) ? 1 : 0;
  } else if (prev === NftAvailable.AUCTION) {
    nftsOnSale = 0;
    nftsOnAuction = curr === NftAvailable.UNAVAILABLE ? -1 : 0;
  } else if (prev === NftAvailable.AUCTION_AND_SALE) {
    nftsOnSale = curr === NftAvailable.UNAVAILABLE ? -1 : 0;
    nftsOnAuction = curr === NftAvailable.UNAVAILABLE ? -1 : 0;
  }

  return { nftsOnSale, nftsOnAuction };
};

const getAvailableNftsChange = (prev: NftAvailable, curr: NftAvailable, prevOwner = '') => {
  if (prev === curr || prevOwner) {
    return 0;
  }
  return curr === NftAvailable.SALE ? 1 : -1;
};
