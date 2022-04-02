import * as functions from 'firebase-functions';
import { Change } from "firebase-functions";
import { DocumentSnapshot } from "firebase-functions/v1/firestore";
import { COL } from '../../interfaces/models/base';
import { Nft, NftAvailable } from '../../interfaces/models/nft';
import { low } from '../scale.settings';

// Listen for changes in all documents in the NFT and update to prepare it for filtering.
export const nftWrite: functions.CloudFunction<Change<DocumentSnapshot>> = functions.runWith({
  timeoutSeconds: 300,
  minInstances: low
}).firestore.document(COL.NFT + '/{nftId}').onWrite(async (change) => {
  const newValue: Nft = <Nft>change.after.data();
  let update = false;

  // Update Availability
  if (newValue.availableFrom && newValue.auctionFrom && newValue.available !== NftAvailable.AUCTION_AND_SALE){
    newValue.available = NftAvailable.AUCTION_AND_SALE;
    update = true;
  } else if (newValue.availableFrom && newValue.available !== NftAvailable.SALE) {
    newValue.available = NftAvailable.SALE;
    update = true;
  } else if (newValue.auctionFrom && newValue.available !== NftAvailable.AUCTION) {
    newValue.available = NftAvailable.AUCTION;
    update = true;
  } else if (!newValue.availableFrom && !newValue.auctionFrom && newValue.available !== NftAvailable.UNAVAILABLE) {
    newValue.available = NftAvailable.UNAVAILABLE;
    update = true;
  }

  if (newValue.owner && !newValue.isOwned) {
    newValue.isOwned = true;
    update = true;
  }

  if (update) {
    return change.after.ref.update({
      isOwned: newValue.isOwned || false,
      available: newValue.available || NftAvailable.UNAVAILABLE
    });
  } else {
    return;
  }
});
