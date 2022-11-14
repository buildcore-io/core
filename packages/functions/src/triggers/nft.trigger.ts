import { COL, Nft, NftAvailable, WEN_FUNC } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import admin from '../admin.config';
import { scale } from '../scale.settings';
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
  })
  .firestore.document(COL.NFT + '/{nftId}')
  .onWrite(async (change) => {
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
  });
