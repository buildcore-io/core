import { IDocument, build5Db } from '@build-5/database';
import { Auction, COL, MIN_IOTA_AMOUNT, Nft, WenError } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { set } from 'lodash';
import { setForSaleNft } from '../../../src/runtime/firebase/nft';
import { dateToTimestamp } from '../../../src/utils/dateTime.utils';
import { testEnv } from '../../set-up';
import { expectThrow, mockWalletReturnValue, wait } from '../common';
import { Helper, dummyAuctionData } from './Helper';

describe('Nft bidding with extended auction', () => {
  const h = new Helper();

  let now: dayjs.Dayjs;
  let nftDocRef: IDocument;

  beforeAll(async () => {
    await h.beforeAll();
  });

  beforeEach(async () => {
    await h.beforeEach();
  });

  const setForSale = async (auctionCustomLength?: number, extendAuctionWithin?: number) => {
    now = dayjs();
    const auctionData = {
      ...dummyAuctionData(h.nft.uid, auctionCustomLength, now),
      extendedAuctionLength: 60000 * 10,
    };
    extendAuctionWithin && set(auctionData, 'extendAuctionWithin', extendAuctionWithin);
    mockWalletReturnValue(h.spy, h.member, auctionData);
    await testEnv.wrap(setForSaleNft)({});

    nftDocRef = build5Db().doc(`${COL.NFT}/${h.nft.uid}`);
    await wait(async () => {
      h.nft = <Nft>await nftDocRef.get();
      return h.nft.available === 3;
    });
  };

  it('Should bid and auction date to extended date', async () => {
    await setForSale();

    expect(h.nft.auctionLength).toBe(60000 * 4);
    let auctionToDate = dayjs(h.nft.auctionTo?.toDate());
    const expectedAuctionToDate = dayjs(dateToTimestamp(now, true).toDate()).add(
      h.nft.auctionLength!,
    );
    expect(auctionToDate.isSame(expectedAuctionToDate)).toBe(true);

    let auctionExtendedDate = dayjs(h.nft.extendedAuctionTo?.toDate());
    const expectedAuctionExtendedToDate = dayjs(dateToTimestamp(now, true).toDate()).add(
      h.nft.extendedAuctionLength!,
    );
    expect(auctionExtendedDate.isSame(expectedAuctionExtendedToDate)).toBe(true);
    expect(h.nft.extendedAuctionLength).toBe(60000 * 10);

    await h.bidNft(h.members[0], MIN_IOTA_AMOUNT);
    h.nft = <Nft>await build5Db().doc(`${COL.NFT}/${h.nft.uid}`).get();
    expect(h.nft.auctionHighestBidder).toBe(h.members[0]);

    h.nft = <Nft>await nftDocRef.get();
    auctionToDate = dayjs(h.nft.auctionTo?.toDate());
    auctionExtendedDate = dayjs(h.nft.extendedAuctionTo?.toDate());
    expect(auctionToDate.isSame(expectedAuctionExtendedToDate)).toBe(true);
    expect(h.nft.auctionLength).toBe(h.nft.extendedAuctionLength);

    const auctionDocRef = build5Db().doc(`${COL.AUCTION}/${h.nft.auction}`);
    const auction = <Auction>await auctionDocRef.get();
    auctionToDate = dayjs(auction.auctionTo?.toDate());
    auctionExtendedDate = dayjs(auction.extendedAuctionTo?.toDate());
    expect(auctionToDate.isSame(expectedAuctionExtendedToDate)).toBe(true);
    expect(auction.auctionLength).toBe(auction.extendedAuctionLength);
  });

  it('Should bid but not set auction date to extended date', async () => {
    await setForSale(60000 * 6);
    h.nft = <Nft>await nftDocRef.get();

    expect(h.nft.auctionLength).toBe(60000 * 6);
    let auctionToDate = dayjs(h.nft.auctionTo?.toDate());
    const expectedAuctionToDate = dayjs(dateToTimestamp(now, true).toDate()).add(
      h.nft.auctionLength!,
    );
    expect(auctionToDate.isSame(expectedAuctionToDate)).toBe(true);

    let auctionExtendedDate = dayjs(h.nft.extendedAuctionTo?.toDate());
    const expectedAuctionExtendedToDate = dayjs(dateToTimestamp(now, true).toDate()).add(
      h.nft.extendedAuctionLength!,
    );
    expect(auctionExtendedDate.isSame(expectedAuctionExtendedToDate)).toBe(true);
    expect(h.nft.extendedAuctionLength).toBe(60000 * 10);

    await h.bidNft(h.members[0], MIN_IOTA_AMOUNT);
    h.nft = <Nft>await nftDocRef.get();
    expect(h.nft.auctionHighestBidder).toBe(h.members[0]);
    auctionToDate = dayjs(h.nft.auctionTo?.toDate());
    expect(auctionToDate.isSame(expectedAuctionToDate)).toBe(true);
    expect(h.nft.auctionLength).toBe(60000 * 6);

    const auctionDocRef = build5Db().doc(`${COL.AUCTION}/${h.nft.auction}`);
    const auction = <Auction>await auctionDocRef.get();
    auctionToDate = dayjs(auction.auctionTo?.toDate());
    expect(auctionToDate.isSame(expectedAuctionToDate)).toBe(true);
    expect(auction.auctionLength).toBe(60000 * 6);
  });

  it('Should throw, extended auction lenght must be greater then auction lenght', async () => {
    const auctionData = {
      ...dummyAuctionData(h.nft.uid),
      extendedAuctionLength: 60000 * 3,
    };
    mockWalletReturnValue(h.spy, h.member, auctionData);
    await expectThrow(testEnv.wrap(setForSaleNft)({}), WenError.invalid_params.key);
  });

  it('Should bid but custom extend within time', async () => {
    await setForSale(60000 * 6, 60000 * 6);
    h.nft = <Nft>await nftDocRef.get();

    expect(h.nft.auctionLength).toBe(60000 * 6);
    let auctionToDate = dayjs(h.nft.auctionTo?.toDate());
    const expectedAuctionToDate = dayjs(dateToTimestamp(now, true).toDate()).add(
      h.nft.auctionLength!,
    );
    expect(auctionToDate.isSame(expectedAuctionToDate)).toBe(true);

    let auctionExtendedDate = dayjs(h.nft.extendedAuctionTo?.toDate());
    const expectedAuctionExtendedToDate = dayjs(dateToTimestamp(now, true).toDate()).add(
      h.nft.extendedAuctionLength!,
    );
    expect(auctionExtendedDate.isSame(expectedAuctionExtendedToDate)).toBe(true);
    expect(h.nft.extendedAuctionLength).toBe(60000 * 10);

    await h.bidNft(h.members[0], MIN_IOTA_AMOUNT);
    h.nft = <Nft>await nftDocRef.get();
    expect(h.nft.auctionHighestBidder).toBe(h.members[0]);
    auctionToDate = dayjs(h.nft.auctionTo?.toDate());
    auctionExtendedDate = dayjs(h.nft.extendedAuctionTo?.toDate());
    expect(auctionToDate.isSame(auctionExtendedDate)).toBe(true);
    expect(h.nft.auctionLength).toBe(60000 * 10);
  });

  it('Should throw, invalid extendAuctionWithin', async () => {
    const auctionData = {
      ...dummyAuctionData(h.nft.uid),
      extendedAuctionLength: 60000 * 10,
      extendAuctionWithin: 0,
    };
    mockWalletReturnValue(h.spy, h.member, auctionData);
    await expectThrow(testEnv.wrap(setForSaleNft)({}), WenError.invalid_params.key);
  });
});
