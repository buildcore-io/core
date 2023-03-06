/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Collection, Nft, NftAvailable, NftStatus } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';
import admin from '../../../src/admin.config';
import { uOn } from '../../../src/utils/dateTime.utils';

export const collectionStatsRoll = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;
  do {
    let query = db.collection(COL.COLLECTION).limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    for (const doc of snap.docs) {
      await setCollectionStats(db, doc.data() as Collection);
    }
  } while (lastDoc);
};

const setCollectionStats = async (db: Firestore, collection: Collection) => {
  const nftSnap = await db.collection(COL.NFT).where('collection', '==', collection.uid).get();

  const nftsOnAuction = nftSnap.docs.filter((doc) => {
    const nft = doc.data() as Nft;
    return (
      [NftAvailable.AUCTION, NftAvailable.AUCTION_AND_SALE].includes(nft.available) && nft.owner
    );
  });
  const nftsOnSale = nftSnap.docs.filter((doc) => {
    const nft = doc.data() as Nft;
    return [NftAvailable.SALE, NftAvailable.AUCTION_AND_SALE].includes(nft.available) && nft.owner;
  });
  const availableNfts = nftSnap.docs.filter((doc) => {
    const nft = doc.data() as Nft;
    return !nft.owner && !nft.placeholderNft && nft.available === NftAvailable.SALE;
  });
  const total = nftSnap.docs.filter((doc) => {
    const nft = doc.data() as Nft;
    return (
      (nft.status === NftStatus.PRE_MINTED || nft.status === NftStatus.MINTED) &&
      !nft.placeholderNft
    );
  });

  const collectionDocRef = db.doc(`${COL.COLLECTION}/${collection.uid}`);
  await collectionDocRef.update({
    nftsOnAuction: nftsOnAuction.length,
    nftsOnSale: nftsOnSale.length,
    availableNfts: availableNfts.length,
    total: total.length,
  });

  if (collection.placeholderNft) {
    const placeholderNftDocRef = admin.firestore().doc(`${COL.NFT}/${collection.placeholderNft}`);
    await placeholderNftDocRef.update(uOn({ hidden: !availableNfts.length }));
  }
};

export const roll = collectionStatsRoll;
