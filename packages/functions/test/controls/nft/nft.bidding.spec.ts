import { build5Db } from '@build-5/database';
import {
  Auction,
  COL,
  Collection,
  MIN_IOTA_AMOUNT,
  Nft,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
} from '@build-5/interfaces';
import { orderNft, setForSaleNft } from '../../../src/runtime/firebase/nft';
import { testEnv } from '../../set-up';
import { mockWalletReturnValue, submitMilestoneFunc, wait } from '../common';
import { Helper, dummyAuctionData } from './Helper';

describe('Nft bidding', () => {
  const h = new Helper();

  beforeAll(async () => {
    await h.beforeAll();
  });

  beforeEach(async () => {
    await h.beforeEach();
    mockWalletReturnValue(h.spy, h.member, dummyAuctionData(h.nft.uid));
    await testEnv.wrap(setForSaleNft)({});
    await wait(async () => {
      const docRef = build5Db().doc(`${COL.NFT}/${h.nft.uid}`);
      h.nft = <Nft>await docRef.get();
      return h.nft.available === 3;
    });
  });

  it('Should create bid request', async () => {
    await h.bidNft(h.members[0], MIN_IOTA_AMOUNT);
    const snap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.ORDER)
      .where('payload.type', '==', TransactionPayloadType.NFT_BID)
      .where('member', '==', h.members[0])
      .get();
    expect(snap.length).toBe(1);
    const tran = <Transaction>snap[0];
    expect(tran.payload.beneficiary).toBe('member');
    expect(tran.payload.beneficiaryUid).toBe(h.member);
    expect(tran.payload.royaltiesFee).toBe(h.collection.royaltiesFee);
    expect(tran.payload.royaltiesSpace).toBe(h.collection.royaltiesSpace);
    expect(tran.payload.expiresOn).toBeDefined();
    expect(tran.payload.reconciled).toBe(true);
    expect(tran.payload.validationType).toBe(TransactionValidationType.ADDRESS);
    expect(tran.payload.nft).toBe(h.nft.uid);
    expect(tran.payload.collection).toBe(h.collection.uid);

    const nftDocRef = build5Db().doc(`${COL.NFT}/${h.nft.uid}`);
    h.nft = <Nft>await nftDocRef.get();
    expect(h.nft.lastTradedOn).toBeDefined();
    expect(h.nft.totalTrades).toBe(1);
    expect(h.nft.auctionHighestBid).toBe(MIN_IOTA_AMOUNT);
    expect(h.nft.auctionHighestBidder).toBe(h.members[0]);

    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${h.nft.collection}`);
    h.collection = <Collection>await collectionDocRef.get();
    expect(h.collection.lastTradedOn).toBeDefined();
    expect(h.collection.totalTrades).toBe(1);

    const auctionDocRef = build5Db().doc(`${COL.AUCTION}/${h.nft.auction}`);
    const auction = <Auction>await auctionDocRef.get();
    expect(auction.bids.length).toBe(1);
    expect(auction.bids[0].amount).toBe(MIN_IOTA_AMOUNT);
    expect(auction.bids[0].bidder).toBe(h.members[0]);
  });

  it('Should override 2 bids for same user', async () => {
    await h.bidNft(h.members[0], MIN_IOTA_AMOUNT);
    await h.bidNft(h.members[0], 2 * MIN_IOTA_AMOUNT);

    const auctionDocRef = build5Db().doc(`${COL.AUCTION}/${h.nft.auction}`);
    const auction = <Auction>await auctionDocRef.get();
    expect(auction.bids.length).toBe(1);
    expect(auction.bids[0].amount).toBe(2 * MIN_IOTA_AMOUNT);
    expect(auction.bids[0].bidder).toBe(h.members[0]);

    const orders = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.members[0])
      .where('type', '==', TransactionType.ORDER)
      .where('payload.type', '==', TransactionPayloadType.NFT_BID)
      .get<Transaction>();
    expect(orders.length).toBe(2);

    const credits = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.members[0])
      .where('type', '==', TransactionType.CREDIT)
      .get<Transaction>();
    expect(credits.length).toBe(1);
    expect(credits[0].payload.amount).toBe(MIN_IOTA_AMOUNT);
  });

  it('Should overbid 2 bids, topup', async () => {
    const auctionDocRef = build5Db().doc(`${COL.AUCTION}/${h.nft.auction}`);
    await auctionDocRef.update({ topUpBased: true });

    await h.bidNft(h.members[0], MIN_IOTA_AMOUNT);
    await h.bidNft(h.members[0], MIN_IOTA_AMOUNT);

    let auction = <Auction>await auctionDocRef.get();
    expect(auction.bids.length).toBe(1);
    expect(auction.bids[0].amount).toBe(2 * MIN_IOTA_AMOUNT);
    expect(auction.bids[0].bidder).toBe(h.members[0]);
    expect(auction.auctionHighestBid).toBe(2 * MIN_IOTA_AMOUNT);
    expect(auction.auctionHighestBidder).toBe(h.members[0]);

    const nftDocRef = build5Db().doc(`${COL.NFT}/${h.nft.uid}`);
    h.nft = <Nft>await nftDocRef.get();
    expect(h.nft.auctionHighestBid).toBe(2 * MIN_IOTA_AMOUNT);
    expect(h.nft.auctionHighestBidder).toBe(h.members[0]);

    await h.bidNft(h.members[1], 3 * MIN_IOTA_AMOUNT);
    auction = <Auction>await auctionDocRef.get();
    expect(auction.bids.length).toBe(1);
    expect(auction.bids[0].amount).toBe(3 * MIN_IOTA_AMOUNT);
    expect(auction.bids[0].bidder).toBe(h.members[1]);
    expect(auction.auctionHighestBid).toBe(3 * MIN_IOTA_AMOUNT);
    expect(auction.auctionHighestBidder).toBe(h.members[1]);

    h.nft = <Nft>await nftDocRef.get();
    expect(h.nft.auctionHighestBid).toBe(3 * MIN_IOTA_AMOUNT);
    expect(h.nft.auctionHighestBidder).toBe(h.members[1]);

    const payments = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.members[0])
      .where('type', '==', TransactionType.PAYMENT)
      .get<Transaction>();
    for (const payment of payments) {
      expect(payment.payload.invalidPayment).toBe(true);
      const credit = await build5Db()
        .collection(COL.TRANSACTION)
        .where('payload.sourceTransaction', 'array-contains', payment.uid)
        .get<Transaction>();
      expect(credit).toBeDefined();
    }
  });

  it('Should reject smaller bid', async () => {
    const nftDocRef = build5Db().doc(`${COL.NFT}/${h.nft.uid}`);
    await h.bidNft(h.members[0], 2 * MIN_IOTA_AMOUNT);
    h.nft = <Nft>await nftDocRef.get();
    expect(h.nft.auctionHighestBidder).toBe(h.members[0]);

    await h.bidNft(h.members[1], MIN_IOTA_AMOUNT);
    h.nft = <Nft>await nftDocRef.get();
    expect(h.nft.auctionHighestBidder).toBe(h.members[0]);

    const snap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', h.members[1])
      .where('payload.nft', '==', h.nft.uid)
      .get();
    expect(snap.length).toBe(1);
  });

  it('Should reject bid where min inc is too small', async () => {
    const nftDocRef = build5Db().doc(`${COL.NFT}/${h.nft.uid}`);
    await h.bidNft(h.members[0], MIN_IOTA_AMOUNT);

    h.nft = <Nft>await nftDocRef.get();
    expect(h.nft.auctionHighestBidder).toBe(h.members[0]);

    await h.bidNft(h.members[0], 1.5 * MIN_IOTA_AMOUNT);

    const snap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', h.members[0])
      .where('payload.nft', '==', h.nft.uid)
      .get<Transaction>();
    expect(snap.length).toBe(1);
    expect(snap[0].payload.amount).toBe(1.5 * MIN_IOTA_AMOUNT);
  });

  it('Should bid in parallel', async () => {
    const bidPromises = [
      h.bidNft(h.members[0], 2 * MIN_IOTA_AMOUNT),
      h.bidNft(h.members[1], 3 * MIN_IOTA_AMOUNT),
      h.bidNft(h.members[2], MIN_IOTA_AMOUNT),
    ];
    await Promise.all(bidPromises);

    const nftDocRef = build5Db().doc(`${COL.NFT}/${h.nft.uid}`);
    h.nft = <Nft>await nftDocRef.get();
    expect(h.nft.auctionHighestBidder).toBe(h.members[1]);

    const transactionSnap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', 'in', [h.members[0], h.members[2]])
      .where('payload.nft', '==', h.nft.uid)
      .get();
    expect(transactionSnap.length).toBe(2);
  });

  it('Should create bid, then credit on sold', async () => {
    await h.bidNft(h.members[0], MIN_IOTA_AMOUNT);
    await h.bidNft(h.members[0], MIN_IOTA_AMOUNT);

    mockWalletReturnValue(h.spy, h.members[1], { collection: h.nft.collection, nft: h.nft.uid });
    const nftOrder = await testEnv.wrap(orderNft)({});
    await submitMilestoneFunc(nftOrder);

    const nftDocRef = build5Db().doc(`${COL.NFT}/${h.nft.uid}`);
    h.nft = <Nft>await nftDocRef.get();
    expect(h.nft.owner).toBe(h.members[1]);

    const credits = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.members[0])
      .where('type', '==', TransactionType.CREDIT)
      .get<Transaction>();
    expect(credits.length).toBe(2);
  });
});
