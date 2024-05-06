import { database } from '@buildcore/database';
import {
  Auction,
  COL,
  Collection,
  MIN_IOTA_AMOUNT,
  Nft,
  NftAvailable,
  NotificationType,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { finalizeAuctions } from '../../../src/cron/auction.cron';
import { mockWalletReturnValue, testEnv } from '../../set-up';
import { wait } from '../common';
import { Helper, dummyAuctionData } from './Helper';

describe('Should finalize bidding', () => {
  const h = new Helper();

  beforeEach(async () => {
    await h.beforeEach();
    mockWalletReturnValue(h.member, dummyAuctionData(h.nft.uid));
    await testEnv.wrap(WEN_FUNC.setForSaleNft);
    await wait(async () => {
      const docRef = database().doc(COL.NFT, h.nft.uid);
      h.nft = <Nft>await docRef.get();
      return h.nft.available === 3;
    });
  });

  it.each([true, false])('Should bid and finalize it', async (noRoyaltySpace: boolean) => {
    if (noRoyaltySpace) {
      await database()
        .doc(COL.COLLECTION, h.collection.uid)
        .update({ royaltiesSpace: '', royaltiesFee: 0 });
    }
    const bidOrder = await h.bidNft(h.members[0], MIN_IOTA_AMOUNT);
    expect(bidOrder.payload.restrictions!.collection).toEqual({
      access: h.collection.access,
      accessAwards: h.collection.accessAwards || [],
      accessCollections: h.collection.accessCollections || [],
    });
    expect(bidOrder.payload.restrictions!.nft).toEqual({
      saleAccess: h.nft.saleAccess || undefined,
      saleAccessMembers: h.nft.saleAccessMembers || [],
    });
    const nftDocRef = database().doc(COL.NFT, h.nft.uid);
    h.nft = <Nft>await nftDocRef.get();
    expect(h.nft.auctionHighestBidder).toBe(h.members[0]);
    const collectionDocRef = database().doc(COL.COLLECTION, h.nft.collection);
    h.collection = <Collection>await collectionDocRef.get();
    expect(h.collection.nftsOnAuction).toBe(1);
    const auctionDocRef = database().doc(COL.AUCTION, h.nft.auction!);
    await auctionDocRef.update({ auctionTo: dayjs().subtract(1, 'minute').toDate() });
    await finalizeAuctions();
    await wait(async () => {
      h.nft = <Nft>await nftDocRef.get();
      return h.nft.available === NftAvailable.UNAVAILABLE;
    });
    expect(h.nft.owner).toBe(h.members[0]);
    expect(h.nft.auctionFrom).toBeUndefined();
    expect(h.nft.auctionTo).toBeUndefined();
    expect(h.nft.auction).toBeUndefined();
    const snap = await database()
      .collection(COL.NOTIFICATION)
      .where('member', '==', h.members[0])
      .where('type', '==', NotificationType.WIN_BID)
      .get();
    expect(snap.length).toBe(1);
    h.collection = <Collection>await collectionDocRef.get();
    expect(h.collection.nftsOnAuction).toBe(0);
    expect(h.collection.lastTradedOn).toBeDefined();
    expect(h.collection.totalTrades).toBe(2);
    h.nft = <Nft>await nftDocRef.get();
    expect(h.nft.lastTradedOn).toBeDefined();
    expect(h.nft.totalTrades).toBe(2);
    const billPayments = await database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload_nft', '==', h.nft.uid)
      .get();
    for (const billPayment of billPayments) {
      expect(billPayment.payload.restrictions).toEqual(bidOrder.payload.restrictions);
    }
    const auction = <Auction>await auctionDocRef.get();
    expect(auction.active).toBe(false);
  });

  it('Should finalize it, no bids', async () => {
    const auctionDocRef = database().doc(COL.AUCTION, h.nft.auction!);
    await auctionDocRef.update({ auctionTo: dayjs().subtract(1, 'minute').toDate() });
    await finalizeAuctions();
    const nftDocRef = database().doc(COL.NFT, h.nft.uid);
    await wait(async () => {
      h.nft = <Nft>await nftDocRef.get();
      return h.nft.available === NftAvailable.SALE;
    });
    expect(h.nft.owner).toBe(h.member);
    expect(h.nft.auctionFrom).toBeUndefined();
    expect(h.nft.auctionTo).toBeUndefined();
    expect(h.nft.auction).toBeUndefined();
  });
});
