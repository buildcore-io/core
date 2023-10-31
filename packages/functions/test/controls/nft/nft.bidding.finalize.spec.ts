import { build5Db } from '@build-5/database';
import {
  Auction,
  COL,
  Collection,
  MIN_IOTA_AMOUNT,
  Nft,
  NftAvailable,
  NotificationType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { finalizeAuctions } from '../../../src/cron/auction.cron';
import { setForSaleNft } from '../../../src/runtime/firebase/nft';
import { dateToTimestamp } from '../../../src/utils/dateTime.utils';
import { testEnv } from '../../set-up';
import { mockWalletReturnValue, wait } from '../common';
import { Helper, dummyAuctionData } from './Helper';

describe('Should finalize bidding', () => {
  const h = new Helper();

  beforeAll(async () => {
    await h.beforeAll();
  });

  beforeEach(async () => {
    await h.beforeEach();
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

  it.each([true, false])('Should bid and finalize it', async (noRoyaltySpace: boolean) => {
    if (noRoyaltySpace) {
      await build5Db()
        .doc(`${COL.COLLECTION}/${h.collection.uid}`)
        .update({ royaltiesSpace: '', royaltiesFee: 0 });
    }
    const bidOrder = await h.bidNft(h.members[0], MIN_IOTA_AMOUNT);
    expect(bidOrder.payload.restrictions.collection).toEqual({
      access: h.collection.access,
      accessAwards: h.collection.accessAwards || [],
      accessCollections: h.collection.accessCollections || [],
    });
    expect(bidOrder.payload.restrictions.nft).toEqual({
      saleAccess: h.nft.saleAccess || null,
      saleAccessMembers: h.nft.saleAccessMembers || [],
    });

    const nftDocRef = build5Db().doc(`${COL.NFT}/${h.nft.uid}`);
    h.nft = <Nft>await nftDocRef.get();
    expect(h.nft.auctionHighestBidder).toBe(h.members[0]);

    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${h.nft.collection}`);
    h.collection = <Collection>await collectionDocRef.get();
    expect(h.collection.nftsOnAuction).toBe(1);

    const auctionDocRef = build5Db().doc(`${COL.AUCTION}/${h.nft.auction}`);
    await auctionDocRef.update({ auctionTo: dateToTimestamp(dayjs().subtract(1, 'minute')) });

    await finalizeAuctions();

    await wait(async () => {
      h.nft = <Nft>await nftDocRef.get();
      return h.nft.available === NftAvailable.UNAVAILABLE;
    });
    expect(h.nft.owner).toBe(h.members[0]);
    expect(h.nft.auctionFrom).toBeNull();
    expect(h.nft.auctionTo).toBeNull();
    expect(h.nft.auction).toBeNull();

    const snap = await build5Db()
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

    const billPayments = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload.nft', '==', h.nft.uid)
      .get<Transaction>();
    for (const billPayment of billPayments) {
      expect(billPayment.payload.restrictions).toEqual(bidOrder.payload.restrictions);
    }

    const auction = <Auction>await auctionDocRef.get();
    expect(auction.active).toBe(false);
  });
});
