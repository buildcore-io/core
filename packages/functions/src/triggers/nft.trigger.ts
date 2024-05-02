import { PgNft, database } from '@buildcore/database';
import { COL, MediaStatus, NftAvailable } from '@buildcore/interfaces';
import { downloadMediaAndPackCar, nftToIpfsMetadata } from '../utils/car.utils';
import { PgDocEvent } from './common';

const getNftAvailability = (nft: PgNft | undefined) => {
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

export const onNftWrite = async (event: PgDocEvent<PgNft>) => {
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

    const collectionDocRef = database().doc(COL.COLLECTION, curr.collection!);
    await collectionDocRef.update({
      nftsOnSale: database().inc(nftsOnSale),
      nftsOnAuction: database().inc(nftsOnAuction),
      availableNfts: database().inc(availableNfts),
    });

    const docRef = database().doc(COL.NFT, curr.uid);
    await docRef.update({ available: currAvailability });
  }

  if (prev?.mediaStatus !== curr.mediaStatus && curr.mediaStatus === MediaStatus.PREPARE_IPFS) {
    await prepareNftMedia(curr);
  }
};

const prepareNftMedia = async (nft: PgNft) => {
  const collectionDocRef = database().doc(COL.COLLECTION, nft.collection!);
  const nftDocRef = database().doc(COL.NFT, nft.uid);
  const batch = database().batch();

  if (nft.ipfsRoot) {
    batch.update(nftDocRef, { mediaStatus: MediaStatus.PENDING_UPLOAD });
  } else {
    const collection = (await collectionDocRef.get())!;
    const metadata = nftToIpfsMetadata(collection, nft);
    const ipfs = await downloadMediaAndPackCar(nft.uid, nft.media!, metadata);
    batch.update(nftDocRef, {
      mediaStatus: MediaStatus.PENDING_UPLOAD,
      ipfsMedia: ipfs.ipfsMedia,
      ipfsMetadata: ipfs.ipfsMetadata,
      ipfsRoot: ipfs.ipfsRoot,
    });
  }

  batch.update(collectionDocRef, { mintingData_nftMediaToPrepare: database().inc(-1) });
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
