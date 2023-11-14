import { IDocument, build5App, build5Db } from '@build-5/database';
import {
  Access,
  Auction,
  AuctionType,
  COL,
  Categories,
  Collection,
  CollectionType,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  NftAccess,
  Space,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { nftAuctionRoll } from '../../scripts/dbUpgrades/1.0.0/auction.roll';
import { approveCollection, createCollection } from '../../src/runtime/firebase/collection';
import { createNft, openBid, orderNft, setForSaleNft } from '../../src/runtime/firebase/nft';
import * as wallet from '../../src/utils/wallet.utils';
import {
  createMember,
  createSpace,
  mockWalletReturnValue,
  submitMilestoneFunc,
  wait,
} from '../controls/common';
import { MEDIA, testEnv } from '../set-up';

describe('Nft auction roll', () => {
  let spy: any;
  let member: string;
  let members: string[];
  let space: Space;
  let collection: Collection;
  let nft: Nft;
  let nftDocRef: IDocument;

  beforeAll(async () => {
    spy = jest.spyOn(wallet, 'decodeAuth');
  });

  beforeEach(async () => {
    member = await createMember(spy);
    const memberPromises = Array.from(Array(3)).map(() => createMember(spy));
    members = await Promise.all(memberPromises);
    space = await createSpace(spy, member);

    mockWalletReturnValue(spy, member, dummyCollection(space.uid));
    collection = await testEnv.wrap(createCollection)({});

    mockWalletReturnValue(spy, member, { uid: collection.uid });
    await testEnv.wrap(approveCollection)({});

    mockWalletReturnValue(spy, member, dummyNft(collection.uid));
    nft = await testEnv.wrap(createNft)({});
    nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);

    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${collection.uid}`);
    await wait(async () => {
      collection = <Collection>await collectionDocRef.get();
      return collection.availableNfts === 1;
    });

    mockWalletReturnValue(spy, member, {
      collection: collection.uid,
      nft: nft.uid,
    });
    const nftOrder = await testEnv.wrap(orderNft)({});
    await submitMilestoneFunc(nftOrder);

    await wait(async () => {
      collection = <Collection>await collectionDocRef.get();
      return collection.availableNfts === 0;
    });

    mockWalletReturnValue(spy, member, dummyAuctionData(nft.uid));
    await testEnv.wrap(setForSaleNft)({});
    await wait(async () => {
      nft = <Nft>await nftDocRef.get();
      return nft.available === 3;
    });
  });

  const bidNft = async (memberId: string, amount: number) => {
    mockWalletReturnValue(spy, memberId, { nft: nft.uid });
    const bidOrder = await testEnv.wrap(openBid)({});
    await submitMilestoneFunc(bidOrder, amount);
    return bidOrder;
  };

  it('Should roll nft auction and finalize it.', async () => {
    const bidOrder = await bidNft(members[0], MIN_IOTA_AMOUNT);

    const prevAuctionId = nft.auction;

    const payments = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', members[0])
      .where('type', '==', TransactionType.PAYMENT)
      .get<Transaction>();

    await nftDocRef.update({
      auctionHighestTransaction: payments[0].uid,
      auction: null,
      mintingData: { network: Network.ATOI },
    });

    await nftAuctionRoll(build5App);

    nft = <Nft>await nftDocRef.get();

    expect(nft.auction).not.toBe(prevAuctionId);

    const auctionDocRef = build5Db().doc(`${COL.AUCTION}/${nft.auction}`);
    const auction = <Auction>await auctionDocRef.get();

    expect(dayjs(auction.auctionFrom.toDate()).isSame(nft.auctionFrom?.toDate())).toBe(true);
    expect(dayjs(auction.auctionTo.toDate()).isSame(nft.auctionTo?.toDate())).toBe(true);
    expect(auction.auctionLength).toBe(nft.auctionLength);
    expect(dayjs(auction.extendedAuctionTo!.toDate()).isSame(nft.extendedAuctionTo?.toDate())).toBe(
      true,
    );
    expect(auction.extendedAuctionLength).toBe(nft.extendedAuctionLength);
    expect(auction.extendAuctionWithin).toBe(nft.extendAuctionWithin);
    expect(auction.auctionFloorPrice).toBe(nft.auctionFloorPrice);
    expect(auction.auctionHighestBidder).toBe(nft.auctionHighestBidder);
    expect(auction.auctionHighestBid).toBe(nft.auctionHighestBid);
    expect(auction.maxBids).toBe(1);
    expect(auction.type).toBe(AuctionType.NFT);
    expect(auction.network).toBe(Network.ATOI);
    expect(auction.nftId).toBe(nft.uid);
    expect(auction.active).toBe(true);
    expect(auction.topUpBased).toBe(false);
    expect(auction.bids.length).toBe(1);
    expect(auction.bids[0].amount).toBe(nft.auctionHighestBid);
    expect(auction.bids[0].bidder).toBe(nft.auctionHighestBidder);
    expect(auction.bids[0].order).toBe(bidOrder.uid);
  });
});

const dummyCollection = (space: string) => ({
  name: 'Collection A',
  description: 'babba',
  type: CollectionType.CLASSIC,
  royaltiesFee: 0.6,
  category: Categories.ART,
  access: Access.OPEN,
  space,
  royaltiesSpace: space,
  onePerMemberOnly: false,
  availableFrom: dayjs().toDate(),
  price: 10 * 1000 * 1000,
});

const dummyNft = (collection: string, description = 'babba') => ({
  media: MEDIA,
  name: 'Collection A',
  description,
  collection,
  availableFrom: dayjs().toDate(),
  price: 10 * 1000 * 1000,
});

const dummyAuctionData = (uid: string, auctionLength = 60000 * 4, from: dayjs.Dayjs = dayjs()) => ({
  nft: uid,
  price: MIN_IOTA_AMOUNT,
  availableFrom: from.toDate(),
  auctionFrom: from.toDate(),
  auctionFloorPrice: MIN_IOTA_AMOUNT,
  auctionLength,
  extendedAuctionLength: 60000 * 5,
  access: NftAccess.OPEN,
});
