import * as functions from 'firebase-functions';
import { WEN_FUNC } from '../../interfaces/functions';
import { COL } from '../../interfaces/models/base';
import { Nft, NftAvailable } from '../../interfaces/models/nft';
import admin from '../admin.config';
import { scale } from '../scale.settings';

const getNftAvailability = (nft: Nft) => {
  if (nft.availableFrom && nft.auctionFrom) {
    return NftAvailable.AUCTION_AND_SALE
  }
  if (nft.availableFrom && !nft.auctionFrom) {
    return NftAvailable.SALE
  }
  if (!nft.availableFrom && nft.auctionFrom) {
    return NftAvailable.AUCTION
  }
  return NftAvailable.UNAVAILABLE
}

export const nftWrite = functions.runWith({
  minInstances: scale(WEN_FUNC.nftWrite)
}).firestore.document(COL.NFT + '/{nftId}').onWrite(async (change, context) => {
  if (!change.after.data()) {
    return
  }
  await admin.firestore().runTransaction(async (transaction) => {
    const docRef = admin.firestore().doc(`${COL.NFT}/${context.params.nftId}`)
    const nft = <Nft | undefined>(await docRef.get()).data()
    if (!nft) {
      return;
    }
    const data = { available: getNftAvailability(nft), isOwned: nft.owner !== undefined }
    if (data.available !== nft.available || data.isOwned !== nft.isOwned) {
      transaction.update(docRef, data)
    }
  })
}
)
