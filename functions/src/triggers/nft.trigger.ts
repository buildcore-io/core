import * as functions from 'firebase-functions';
import { Change } from "firebase-functions";
import { DocumentSnapshot } from "firebase-functions/v1/firestore";
import { WEN_FUNC } from '../../interfaces/functions';
import { COL } from '../../interfaces/models/base';
import { Nft, NftAvailable } from '../../interfaces/models/nft';
import admin from '../admin.config';
import { scale } from '../scale.settings';

// Listen for changes in all documents in the NFT and update to prepare it for filtering.
export const nftWrite: functions.CloudFunction<Change<DocumentSnapshot>> = functions.runWith({
  minInstances: scale(WEN_FUNC.nftWrite)
}).firestore.document(COL.NFT + '/{nftId}').onWrite(async (change) => {
  const newValue = <Nft>change.after.data();
  // Let's wrap this into a transaction.
  await admin.firestore().runTransaction(async (transaction) => {
    if (!newValue) {
      return;
    }

    let update = false;
    const refSource = admin.firestore().collection(COL.NFT).doc(newValue.uid);
    const sfDoc = await transaction.get(refSource);
    if (!sfDoc.data()) {
      return;
    }

    // Data object.
    const nftData = <Nft>sfDoc.data();

    // Update Availability
    if (nftData.availableFrom && nftData.auctionFrom && nftData.available !== NftAvailable.AUCTION_AND_SALE) {
      nftData.available = NftAvailable.AUCTION_AND_SALE;
      update = true;
    } else if (nftData.availableFrom && nftData.available !== NftAvailable.SALE) {
      nftData.available = NftAvailable.SALE;
      update = true;
    } else if (nftData.auctionFrom && nftData.available !== NftAvailable.AUCTION) {
      nftData.available = NftAvailable.AUCTION;
      update = true;
    } else if (!nftData.availableFrom && !nftData.auctionFrom && nftData.available !== NftAvailable.UNAVAILABLE) {
      nftData.available = NftAvailable.UNAVAILABLE;
      update = true;
    }

    if (nftData.owner && !nftData.isOwned) {
      nftData.isOwned = true;
      update = true;
    }

    if (update) {
      transaction.update(refSource, {
        isOwned: nftData.isOwned || false,
        available: nftData.available || NftAvailable.UNAVAILABLE
      });
    }
  });

  return;
});
