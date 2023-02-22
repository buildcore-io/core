/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Collection, Nft, NftAvailable, NftStatus } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';

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

    const promises = snap.docs.map((doc) => setCollectionStats(db, doc.data() as Collection));
    await Promise.all(promises);
  } while (lastDoc);
};

const setCollectionStats = async (db: Firestore, collection: Collection) => {
  const nftSnap = await db.collection(COL.NFT).where('collection', '==', collection.uid).get();
  const nftsOnAuction = nftSnap.docs.filter((doc) => {
    const nft = doc.data() as Nft;
    return [NftAvailable.AUCTION, NftAvailable.AUCTION_AND_SALE].includes(nft.available);
  });
  const availableNfts = nftSnap.docs.filter((doc) => {
    const nft = doc.data() as Nft;
    return nft.available === NftAvailable.SALE && !nft.placeholderNft;
  });

  const total = nftSnap.docs.filter((doc) => {
    const nft = doc.data() as Nft;
    return (
      (nft.status === NftStatus.PRE_MINTED || nft.status === NftStatus.MINTED) &&
      !nft.hidden &&
      !nft.placeholderNft
    );
  });

  const collectionDocRef = db.doc(`${COL.COLLECTION}/${collection.uid}`);
  await collectionDocRef.update({
    nftsOnAuction: nftsOnAuction.length,
    availableNfts: availableNfts.length,
    total: total.length,
  });
};

export const roll = collectionStatsRoll;
