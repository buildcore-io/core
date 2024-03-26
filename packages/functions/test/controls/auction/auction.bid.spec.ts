import { IQuery, build5Db } from '@build-5/database';
import {
  Auction,
  AuctionType,
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { finalizeAuctions } from '../../../src/cron/auction.cron';
import { getAddress } from '../../../src/utils/address.utils';
import { getWallet } from '../../set-up';
import { wait } from '../common';
import { Helper } from './Helper';

describe('Open auction bid', () => {
  const h = new Helper();
  const now = dayjs();

  beforeEach(async () => {
    await h.beforeEach(now);
  });

  it('Should create auction', async () => {
    expect(dayjs(h.auction.auctionFrom.toDate()).isSame(now)).toBe(true);
    expect(dayjs(h.auction.auctionTo.toDate()).isSame(now.add(60000 * 4)));
    expect(h.auction.auctionLength).toBe(60000 * 4);

    expect(dayjs(h.auction.extendedAuctionTo?.toDate()).isSame(now.add(60000 * 4 + 6000))).toBe(
      true,
    );
    expect(h.auction.extendedAuctionLength).toBe(60000 * 4 + 6000);
    expect(h.auction.extendAuctionWithin).toBe(60000 * 4);

    expect(h.auction.auctionFloorPrice).toBe(2 * MIN_IOTA_AMOUNT);
    expect(h.auction.maxBids).toBe(2);
    expect(h.auction.type).toBe(AuctionType.OPEN);
    expect(h.auction.network).toBe(Network.RMS);
    expect(h.auction.nftId).toBeUndefined();
    expect(h.auction.active).toBe(true);
    expect(h.auction.topUpBased).toBe(true);
  });

  it('Should bid on auction', async () => {
    await h.bidOnAuction(h.members[0], 2 * MIN_IOTA_AMOUNT);
    await h.bidOnAuction(h.members[1], 3 * MIN_IOTA_AMOUNT);
    await h.bidOnAuction(h.members[0], 2 * MIN_IOTA_AMOUNT);

    h.auction = <Auction>await h.auctionDocRef.get();
    expect(h.auction.bids.length).toBe(2);
    expect(h.auction.bids[0].amount).toBe(4 * MIN_IOTA_AMOUNT);
    expect(h.auction.bids[0].bidder).toBe(h.members[0]);
    expect(h.auction.bids[1].amount).toBe(3 * MIN_IOTA_AMOUNT);
    expect(h.auction.bids[1].bidder).toBe(h.members[1]);

    expect(h.auction.auctionHighestBidder).toBe(h.members[0]);
    expect(h.auction.auctionHighestBid).toBe(4 * MIN_IOTA_AMOUNT);

    await h.bidOnAuction(h.members[2], 5 * MIN_IOTA_AMOUNT);

    h.auction = <Auction>await h.auctionDocRef.get();
    expect(h.auction.bids.length).toBe(2);
    expect(h.auction.bids[0].amount).toBe(5 * MIN_IOTA_AMOUNT);
    expect(h.auction.bids[0].bidder).toBe(h.members[2]);
    expect(h.auction.bids[1].amount).toBe(4 * MIN_IOTA_AMOUNT);
    expect(h.auction.bids[1].bidder).toBe(h.members[0]);
    expect(h.auction.auctionHighestBidder).toBe(h.members[2]);
    expect(h.auction.auctionHighestBid).toBe(5 * MIN_IOTA_AMOUNT);

    const credits = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .whereIn('member', h.members)
      .get();
    expect(credits.length).toBe(1);
    expect(credits[0].member).toBe(h.members[1]);
  });

  it('Should finalize open auction', async () => {
    await h.bidOnAuction(h.members[0], 2 * MIN_IOTA_AMOUNT);
    await h.bidOnAuction(h.members[0], 3 * MIN_IOTA_AMOUNT);

    const auctionDocRef = build5Db().doc(COL.AUCTION, h.auction.uid);
    await auctionDocRef.update({ auctionTo: dayjs().subtract(1, 'minute').toDate() });

    await finalizeAuctions();

    const memberDocRef = build5Db().doc(COL.MEMBER, h.member);
    const member = await memberDocRef.get();
    const address = getAddress(member, h.auction.network);

    const billPayments = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('member', '==', h.members[0])
      .get();
    billPayments.sort((a, b) => a.payload.amount! - b.payload.amount!);
    expect(billPayments.length).toBe(2);
    expect(billPayments[0].payload.amount!).toBe(2 * MIN_IOTA_AMOUNT);
    expect(billPayments[0].payload.targetAddress).toBe(address);
    expect(billPayments[1].payload.amount!).toBe(3 * MIN_IOTA_AMOUNT);
    expect(billPayments[1].payload.targetAddress).toBe(address);
  });

  it('Should finalize open auction with custom target address', async () => {
    const wallet = await getWallet(h.auction.network);
    const targetAddress = await wallet.getNewIotaAddressDetails();

    await h.createAuction(dayjs(), { targetAddress: targetAddress.bech32 });

    await h.bidOnAuction(h.members[0], 2 * MIN_IOTA_AMOUNT);
    await h.bidOnAuction(h.members[0], 3 * MIN_IOTA_AMOUNT);

    const auctionDocRef = build5Db().doc(COL.AUCTION, h.auction.uid);
    await auctionDocRef.update({ auctionTo: dayjs().subtract(1, 'minute').toDate() });

    await finalizeAuctions();

    const billPayments = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('member', '==', h.members[0])
      .get();
    billPayments.sort((a, b) => a.payload.amount! - b.payload.amount!);
    expect(billPayments.length).toBe(2);
    expect(billPayments[0].payload.amount!).toBe(2 * MIN_IOTA_AMOUNT);
    expect(billPayments[0].payload.targetAddress).toBe(targetAddress.bech32);
    expect(billPayments[1].payload.amount!).toBe(3 * MIN_IOTA_AMOUNT);
    expect(billPayments[1].payload.targetAddress).toBe(targetAddress.bech32);
  });

  it('Should finalize open auction, no bids', async () => {
    const auctionDocRef = build5Db().doc(COL.AUCTION, h.auction.uid);
    await auctionDocRef.update({ auctionTo: dayjs().subtract(1, 'minute').toDate() });
    await finalizeAuctions();
  });

  const awaitPayments = (query: IQuery<any, any>, count: number) =>
    wait(async () => {
      const snap = await query.get();
      return snap.length === count;
    });

  it('Should bid when custom bid increment, topUpBased', async () => {
    await h.createAuction(dayjs(), { minimalBidIncrement: 1.5 * MIN_IOTA_AMOUNT });

    const validPaymentsQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.PAYMENT)
      .where('member', '==', h.members[0])
      .where('payload_invalidPayment', '==', false);
    const invalidPaymentsQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.PAYMENT)
      .where('member', '==', h.members[0])
      .where('payload_invalidPayment', '==', true);

    // Below floor, credit
    await h.bidOnAuction(h.members[0], 1.5 * MIN_IOTA_AMOUNT);
    await awaitPayments(invalidPaymentsQuery, 1);
    await awaitPayments(validPaymentsQuery, 0);

    // Should be valid
    await h.bidOnAuction(h.members[0], 2 * MIN_IOTA_AMOUNT);
    await awaitPayments(invalidPaymentsQuery, 1);
    await awaitPayments(validPaymentsQuery, 1);

    // Below minimal bid, credit
    await h.bidOnAuction(h.members[0], MIN_IOTA_AMOUNT);
    await awaitPayments(invalidPaymentsQuery, 2);
    await awaitPayments(validPaymentsQuery, 1);

    // Should be valid
    await h.bidOnAuction(h.members[0], 1.5 * MIN_IOTA_AMOUNT);
    await awaitPayments(invalidPaymentsQuery, 2);
    await awaitPayments(validPaymentsQuery, 2);
  });

  it('Should bid when custom bid increment, not topUpBased', async () => {
    await h.createAuction(dayjs(), {
      minimalBidIncrement: 1.5 * MIN_IOTA_AMOUNT,
      topUpBased: false,
    });

    const validPaymentsQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.PAYMENT)
      .where('member', '==', h.members[0])
      .where('payload_invalidPayment', '==', false);
    const invalidPaymentsQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.PAYMENT)
      .where('member', '==', h.members[0])
      .where('payload_invalidPayment', '==', true);

    // Below floor, credit
    await h.bidOnAuction(h.members[0], 1.5 * MIN_IOTA_AMOUNT);
    await awaitPayments(invalidPaymentsQuery, 1);
    await awaitPayments(validPaymentsQuery, 0);

    // Should be valid
    await h.bidOnAuction(h.members[0], 2 * MIN_IOTA_AMOUNT);
    await awaitPayments(invalidPaymentsQuery, 1);
    await awaitPayments(validPaymentsQuery, 1);

    // Below minimal bid, credit
    await h.bidOnAuction(h.members[0], 3 * MIN_IOTA_AMOUNT);
    await awaitPayments(invalidPaymentsQuery, 2);
    await awaitPayments(validPaymentsQuery, 1);

    // Should be valid
    await h.bidOnAuction(h.members[0], 3.5 * MIN_IOTA_AMOUNT);
    await awaitPayments(invalidPaymentsQuery, 3);
    await awaitPayments(validPaymentsQuery, 1);
  });
});
