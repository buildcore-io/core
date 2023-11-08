import { FirebaseApp, Firestore } from '@build-5/database';
import {
  Auction,
  AuctionType,
  COL,
  DEFAULT_NETWORK,
  EXTEND_AUCTION_WITHIN,
  Nft,
  SOON_PROJECT_ID,
  Transaction,
} from '@build-5/interfaces';
import { randomBytes } from 'crypto';
import dayjs from 'dayjs';
import { Wallet } from 'ethers';
import { get, head, last } from 'lodash';

export const nftAuctionRoll = async (app: FirebaseApp) => {
  const db = new Firestore(app);

  let lastDocId = '';

  do {
    const lastDoc = lastDocId ? await db.doc(`${COL.NFT}/${lastDocId}`).getSnapshot() : undefined;

    const nfts = await db
      .collection(COL.NFT)
      .where('auctionTo', '>=', dayjs().toDate())
      .startAfter(lastDoc)
      .limit(500)
      .get<Nft>();
    lastDocId = last(nfts)?.uid || '';

    const promises = nfts.map((n) =>
      db.runTransaction(async (transaction) => {
        const nftDocRef = db.doc(`${COL.NFT}/${n.uid}`);
        const nft = <Nft>await transaction.get(nftDocRef);

        if (nft.auction || !nft.auctionTo || dayjs(nft.auctionTo.toDate()).isBefore(dayjs())) {
          return;
        }

        const auction = await getAuctionData(db, nft);
        const auctionDocRef = db.doc(`${COL.AUCTION}/${auction.uid}`);
        transaction.create(auctionDocRef, auction);

        transaction.update(nftDocRef, { auction: auction.uid });
      }),
    );

    await Promise.all(promises);
  } while (lastDocId);
};

const getAuctionData = async (db: Firestore, nft: Nft) => {
  const auction: Auction = {
    uid: getRandomEthAddress(),
    space: nft.space,
    createdBy: nft.owner,
    project: nft.owner || SOON_PROJECT_ID,
    auctionFrom: nft.auctionFrom!,
    auctionTo: nft.auctionTo!,
    auctionFloorPrice: nft.auctionFloorPrice || 0,
    minimalBidIncrement: 0,
    auctionLength: nft.auctionLength || 0,

    bids: [],
    maxBids: 1,
    type: AuctionType.NFT,
    network: nft.mintingData?.network || DEFAULT_NETWORK,
    nftId: nft.uid,

    active: true,
    topUpBased: false,
  };

  if (nft.auctionHighestBidder) {
    auction.auctionHighestBidder = nft.auctionHighestBidder;
    auction.auctionHighestBid = nft.auctionHighestBid || 0;

    const paymentDocRef = db.doc(`${COL.TRANSACTION}/${get(nft, 'auctionHighestTransaction', '')}`);
    const payment = <Transaction>await paymentDocRef.get();
    auction.bids.push({
      bidder: nft.auctionHighestBidder,
      amount: nft.auctionHighestBid || 0,
      order: head(payment.payload.sourceTransaction) || '',
    });
  }

  if (nft.extendedAuctionLength) {
    return {
      ...auction,
      extendedAuctionTo: nft.extendedAuctionTo,
      extendedAuctionLength: nft.extendedAuctionLength || 0,
      extendAuctionWithin: nft.extendAuctionWithin || EXTEND_AUCTION_WITHIN,
    };
  }
  return auction;
};

const getRandomEthAddress = () => {
  const wallet = new Wallet('0x' + randomBytes(32).toString('hex'));
  return wallet.address.toLowerCase();
};

export const roll = nftAuctionRoll;
