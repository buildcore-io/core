import { COL, Collection, MediaStatus, Nft, NftAvailable } from '@build-5/interfaces';
import { build5Db } from '../firebase/firestore/build5Db';
import { downloadMediaAndPackCar, nftToIpfsMetadata } from '../utils/car.utils';
import { FirestoreDocEvent } from './common';

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

export const onNftWrite = async (event: FirestoreDocEvent<Nft>) => {
  const { prev, curr } = event;
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

    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${curr.collection}`);
    await collectionDocRef.update({
      nftsOnSale: build5Db().inc(nftsOnSale),
      nftsOnAuction: build5Db().inc(nftsOnAuction),
      availableNfts: build5Db().inc(availableNfts),
    });

    const docRef = build5Db().doc(event.path);
    await docRef.update({ available: currAvailability });
  }

  if (prev?.mediaStatus !== curr.mediaStatus && curr.mediaStatus === MediaStatus.PREPARE_IPFS) {
    await prepareNftMedia(curr);
  }
};

const prepareNftMedia = async (nft: Nft) => {
  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${nft.collection}`);
  const nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
  const batch = build5Db().batch();

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

  batch.update(collectionDocRef, { 'mintingData.nftMediaToPrepare': build5Db().inc(-1) });
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
