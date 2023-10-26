import { build5Db } from '@build-5/database';
import {
  Auction,
  AuctionType,
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { finalizeAuctions } from '../../../src/cron/auction.cron';
import { dateToTimestamp } from '../../../src/utils/dateTime.utils';
import { Helper } from './Helper';

describe('Open auction bid', () => {
  const h = new Helper();
  const now = dayjs();

  beforeAll(async () => {
    await h.beforeAll();
  });

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
      .where('member', 'in', h.members)
      .where('type', '==', TransactionType.CREDIT)
      .get<Transaction>();
    expect(credits.length).toBe(1);
    expect(credits[0].member).toBe(h.members[1]);
  });

  it('Should finalize auction', async () => {
    await h.bidOnAuction(h.members[0], 2 * MIN_IOTA_AMOUNT);

    const auctionDocRef = build5Db().doc(`${COL.AUCTION}/${h.auction.uid}`);
    await auctionDocRef.update({ auctionTo: dateToTimestamp(dayjs().subtract(1, 'minute')) });

    await finalizeAuctions();
  });
});
