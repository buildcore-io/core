import {
  Access,
  Categories,
  COL,
  Collection,
  CollectionType,
  MIN_IOTA_AMOUNT,
  Nft,
  NftAccess,
  NftAvailable,
  NotificationType,
  Space,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { finalizeAllNftAuctions } from '../../src/cron/nft.cron';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { IDocument } from '../../src/firebase/firestore/interfaces';
import { approveCollection, createCollection } from '../../src/runtime/firebase/collection/index';
import { openBid } from '../../src/runtime/firebase/nft';
import { createNft, orderNft, setForSaleNft } from '../../src/runtime/firebase/nft/index';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { MEDIA, testEnv } from '../set-up';
import {
  createMember,
  createSpace,
  expectThrow,
  milestoneProcessed,
  mockWalletReturnValue,
  submitMilestoneFunc,
  wait,
} from './common';

let walletSpy: any;

const dummyNft = (collection: string, description = 'babba') => ({
  name: 'Collection A',
  description,
  collection,
  availableFrom: dayjs().toDate(),
  price: 10 * 1000 * 1000,
});

const submitOrderFunc = async <T>(address: string, params: T) => {
  mockWalletReturnValue(walletSpy, address, params);
  return await testEnv.wrap(orderNft)({});
};

const dummyAuctionData = (uid: string, auctionLength = 60000 * 4, from: dayjs.Dayjs = dayjs()) => ({
  nft: uid,
  price: MIN_IOTA_AMOUNT,
  availableFrom: from.toDate(),
  auctionFrom: from.toDate(),
  auctionFloorPrice: MIN_IOTA_AMOUNT,
  auctionLength,
  access: NftAccess.OPEN,
});

const dummySaleData = (uid: string) => ({
  nft: uid,
  price: MIN_IOTA_AMOUNT,
  availableFrom: dayjs().toDate(),
  access: NftAccess.OPEN,
});

const bidNft = async (memberId: string, amount: number) => {
  mockWalletReturnValue(walletSpy, memberId, { nft: nft.uid });
  const bidOrder = await testEnv.wrap(openBid)({});
  const nftMilestone = await submitMilestoneFunc(bidOrder.payload.targetAddress, amount);
  await milestoneProcessed(nftMilestone.milestone, nftMilestone.tranId);
  return bidOrder;
};

let memberAddress: string;
let members: string[];
let space: Space;
let collection: Collection;
let nft: any;

beforeEach(async () => {
  walletSpy = jest.spyOn(wallet, 'decodeAuth');
  memberAddress = await createMember(walletSpy);
  const memberPromises = Array.from(Array(3)).map(() => createMember(walletSpy));
  members = await Promise.all(memberPromises);
  space = await createSpace(walletSpy, memberAddress);

  mockWalletReturnValue(walletSpy, memberAddress, {
    name: 'Collection A',
    description: 'babba',
    type: CollectionType.CLASSIC,
    royaltiesFee: 0.6,
    category: Categories.ART,
    access: Access.OPEN,
    space: space.uid,
    royaltiesSpace: space.uid,
    onePerMemberOnly: false,
    availableFrom: dayjs().toDate(),
    price: 10 * 1000 * 1000,
  });

  collection = await testEnv.wrap(createCollection)({});
  mockWalletReturnValue(walletSpy, memberAddress, { uid: collection.uid });
  await testEnv.wrap(approveCollection)({});

  mockWalletReturnValue(walletSpy, memberAddress, { media: MEDIA, ...dummyNft(collection.uid) });
  nft = await testEnv.wrap(createNft)({});

  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${collection.uid}`);
  await wait(async () => {
    collection = <Collection>await collectionDocRef.get();
    return collection.availableNfts === 1;
  });

  const nftOrder = await submitOrderFunc(memberAddress, {
    collection: collection.uid,
    nft: nft.uid,
  });
  const nftMilestone = await submitMilestoneFunc(
    nftOrder.payload.targetAddress,
    nftOrder.payload.amount,
  );
  await milestoneProcessed(nftMilestone.milestone, nftMilestone.tranId);
  await wait(async () => {
    collection = <Collection>await collectionDocRef.get();
    return collection.availableNfts === 0;
  });
});

describe('Nft controller: setForSale', () => {
  it('Should set nft for sale', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, dummySaleData(nft.uid));
    await testEnv.wrap(setForSaleNft)({});

    const nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
    await wait(async () => {
      const nft = <Nft>await nftDocRef.get();
      return nft.available === 1;
    });

    const saleNft = <Nft>await nftDocRef.get();
    expect(saleNft.available).toBe(1);
    expect(saleNft.availableFrom).toBeDefined();

    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${saleNft.collection}`);
    const collection = <Collection>await collectionDocRef.get();
    expect(collection.nftsOnAuction).toBe(0);
    expect(collection.nftsOnSale).toBe(1);
  });

  it('Should throw, nft set as avatar', async () => {
    const nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
    await nftDocRef.update({ setAsAvatar: true });

    mockWalletReturnValue(walletSpy, memberAddress, dummySaleData(nft.uid));
    await expectThrow(testEnv.wrap(setForSaleNft)({}), WenError.nft_set_as_avatar.key);
  });

  it('Should set nft for auction', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, dummyAuctionData(nft.uid));
    await testEnv.wrap(setForSaleNft)({});

    const nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
    await wait(async () => {
      const nft = <Nft>await nftDocRef.get();
      return nft.available === 3;
    });

    const auctionNft = <Nft>await build5Db().doc(`${COL.NFT}/${nft.uid}`).get();
    expect(auctionNft.available).toBe(3);
    expect(auctionNft.auctionFrom).toBeDefined();
    expect(auctionNft.auctionTo).toBeDefined();
    expect(auctionNft.auctionLength).toBeDefined();

    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${auctionNft.collection}`);
    const collection = <Collection>await collectionDocRef.get();
    expect(collection.nftsOnAuction).toBe(1);
    expect(collection.nftsOnSale).toBe(1);
  });

  it('Should throw, auction already in progress', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, dummyAuctionData(nft.uid));
    await testEnv.wrap(setForSaleNft)({});
    mockWalletReturnValue(walletSpy, memberAddress, dummyAuctionData(nft.uid));
    await expectThrow(
      testEnv.wrap(setForSaleNft)({}),
      WenError.nft_auction_already_in_progress.key,
    );
  });

  it('Should throw, invalid nft', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, {
      ...dummyAuctionData(nft.uid),
      nft: wallet.getRandomEthAddress(),
    });
    await expectThrow(testEnv.wrap(setForSaleNft)({}), WenError.nft_does_not_exists.key);
  });

  it('Should throw, not owner', async () => {
    mockWalletReturnValue(walletSpy, members[0], dummyAuctionData(nft.uid));
    await expectThrow(testEnv.wrap(setForSaleNft)({}), WenError.you_must_be_the_owner_of_nft.key);
  });
});

describe('Nft bidding', () => {
  beforeEach(async () => {
    mockWalletReturnValue(walletSpy, memberAddress, dummyAuctionData(nft.uid));
    await testEnv.wrap(setForSaleNft)({});
    await wait(
      async () => (await build5Db().doc(`${COL.NFT}/${nft.uid}`).get<Nft>())?.available === 3,
    );
  });

  it('Should create bid request', async () => {
    await bidNft(members[0], MIN_IOTA_AMOUNT);
    const snap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('payload.type', '==', TransactionPayloadType.NFT_BID)
      .where('member', '==', members[0])
      .get();
    expect(snap.length).toBe(1);
    const tran = <Transaction>snap[0];
    expect(tran.payload.beneficiary).toBe('member');
    expect(tran.payload.beneficiaryUid).toBe(memberAddress);
    expect(tran.payload.royaltiesFee).toBe(collection.royaltiesFee);
    expect(tran.payload.royaltiesSpace).toBe(collection.royaltiesSpace);
    expect(tran.payload.expiresOn).toBeDefined();
    expect(tran.payload.reconciled).toBe(false);
    expect(tran.payload.validationType).toBe(TransactionValidationType.ADDRESS);
    expect(tran.payload.nft).toBe(nft.uid);
    expect(tran.payload.collection).toBe(collection.uid);

    const nftDocRef = build5Db().collection(COL.NFT).doc(nft.uid);
    nft = <Nft>await nftDocRef.get();
    expect(nft.lastTradedOn).toBeDefined();
    expect(nft.totalTrades).toBe(1);

    const collectionDocRef = build5Db().collection(COL.COLLECTION).doc(nft.collection);
    collection = <Collection>await collectionDocRef.get();
    expect(collection.lastTradedOn).toBeDefined();
    expect(collection.totalTrades).toBe(1);
  });

  it('Should bid and send amount', async () => {
    await bidNft(members[0], MIN_IOTA_AMOUNT);
    const nftData = <Nft>await build5Db().doc(`${COL.NFT}/${nft.uid}`).get();
    expect(nftData.auctionHighestBidder).toBe(members[0]);
  });

  it('Should credit lowest bidder', async () => {
    mockWalletReturnValue(walletSpy, members[0], { nft: nft.uid });
    await bidNft(members[0], 2 * MIN_IOTA_AMOUNT);
    const nftData = <Nft>await build5Db().doc(`${COL.NFT}/${nft.uid}`).get();
    expect(nftData.auctionHighestBidder).toBe(members[0]);

    await bidNft(members[1], 3 * MIN_IOTA_AMOUNT);
    const updated = <Nft>await build5Db().doc(`${COL.NFT}/${nft.uid}`).get();
    expect(updated.auctionHighestBidder).toBe(members[1]);

    const snap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', members[0])
      .where('payload.nft', '==', nft.uid)
      .get();
    expect(snap.length).toBe(1);
    const tran = <Transaction>snap[0];

    expect(tran.payload.amount).toBe(2 * MIN_IOTA_AMOUNT);
    expect(tran.payload.nft).toBe(nft.uid);
    expect(tran.payload.reconciled).toBe(true);
    expect(tran.payload.sourceAddress).toBeDefined();
    expect(tran.payload.targetAddress).toBeDefined();
    expect(tran.payload.sourceTransaction!.length).toBe(1);
  });

  it('Should reject smaller bid', async () => {
    await bidNft(members[0], 2 * MIN_IOTA_AMOUNT);
    const nftData = <Nft>await build5Db().doc(`${COL.NFT}/${nft.uid}`).get();
    expect(nftData.auctionHighestBidder).toBe(members[0]);

    await bidNft(members[1], MIN_IOTA_AMOUNT);
    const updated = <Nft>await build5Db().doc(`${COL.NFT}/${nft.uid}`).get();
    expect(updated.auctionHighestBidder).toBe(members[0]);

    const snap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', members[1])
      .where('payload.nft', '==', nft.uid)
      .get();
    expect(snap.length).toBe(1);
  });

  it('Should bid in parallel', async () => {
    const bidPromises = [
      bidNft(members[0], 2 * MIN_IOTA_AMOUNT),
      bidNft(members[1], 3 * MIN_IOTA_AMOUNT),
      bidNft(members[2], MIN_IOTA_AMOUNT),
    ];
    await Promise.all(bidPromises);
    const nftData = <Nft>await build5Db().doc(`${COL.NFT}/${nft.uid}`).get();
    expect(nftData.auctionHighestBidder).toBe(members[1]);

    const transactionSnap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', 'in', [members[0], members[2]])
      .where('payload.nft', '==', nft.uid)
      .get();
    expect(transactionSnap.length).toBe(2);
  });
});

describe('Nft bidding with extended auction', () => {
  let now: dayjs.Dayjs;
  let nftDocRef: IDocument;

  const setForSale = async (auctionCustomLength?: number) => {
    now = dayjs();
    const auctionData = {
      ...dummyAuctionData(nft.uid, auctionCustomLength, now),
      extendedAuctionLength: 60000 * 10,
    };
    mockWalletReturnValue(walletSpy, memberAddress, auctionData);
    await testEnv.wrap(setForSaleNft)({});

    nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
    await wait(async () => (await nftDocRef.get<Nft>())?.available === 3);
  };

  it('Should bid and auction date to extended date', async () => {
    await setForSale();

    let nftData = await nftDocRef.get<Nft>();

    expect(nftData?.auctionLength).toBe(60000 * 4);
    let auctionToDate = dayjs(nftData?.auctionTo?.toDate());
    const expectedAuctionToDate = dayjs(dateToTimestamp(now, true).toDate()).add(
      nftData?.auctionLength!,
    );
    expect(auctionToDate.isSame(expectedAuctionToDate)).toBe(true);

    let auctionExtendedDate = dayjs(nftData?.extendedAuctionTo?.toDate());
    const expectedAuctionExtendedToDate = dayjs(dateToTimestamp(now, true).toDate()).add(
      nftData?.extendedAuctionLength!,
    );
    expect(auctionExtendedDate.isSame(expectedAuctionExtendedToDate)).toBe(true);
    expect(nftData?.extendedAuctionLength).toBe(60000 * 10);

    await bidNft(members[0], MIN_IOTA_AMOUNT);
    nftData = <Nft>await build5Db().doc(`${COL.NFT}/${nft.uid}`).get();
    expect(nftData.auctionHighestBidder).toBe(members[0]);

    nftData = await nftDocRef.get<Nft>();
    auctionToDate = dayjs(nftData?.auctionTo?.toDate());
    auctionExtendedDate = dayjs(nftData?.extendedAuctionTo?.toDate());
    expect(auctionToDate.isSame(expectedAuctionExtendedToDate)).toBe(true);
    expect(nftData?.auctionLength).toBe(nftData?.extendedAuctionLength);
  });

  it('Should bid but not set auction date to extended date', async () => {
    await setForSale(60000 * 6);
    let nftData = await nftDocRef.get<Nft>();

    expect(nftData?.auctionLength).toBe(60000 * 6);
    let auctionToDate = dayjs(nftData?.auctionTo?.toDate());
    const expectedAuctionToDate = dayjs(dateToTimestamp(now, true).toDate()).add(
      nftData?.auctionLength!,
    );
    expect(auctionToDate.isSame(expectedAuctionToDate)).toBe(true);

    let auctionExtendedDate = dayjs(nftData?.extendedAuctionTo?.toDate());
    const expectedAuctionExtendedToDate = dayjs(dateToTimestamp(now, true).toDate()).add(
      nftData?.extendedAuctionLength!,
    );
    expect(auctionExtendedDate.isSame(expectedAuctionExtendedToDate)).toBe(true);
    expect(nftData?.extendedAuctionLength).toBe(60000 * 10);

    await bidNft(members[0], MIN_IOTA_AMOUNT);
    nftData = <Nft>await build5Db().doc(`${COL.NFT}/${nft.uid}`).get();
    expect(nftData.auctionHighestBidder).toBe(members[0]);

    nftData = await nftDocRef.get<Nft>();
    auctionToDate = dayjs(nftData?.auctionTo?.toDate());
    auctionExtendedDate = dayjs(nftData?.extendedAuctionTo?.toDate());
    expect(auctionToDate.isSame(expectedAuctionToDate)).toBe(true);
    expect(nftData?.auctionLength).toBe(60000 * 6);
  });

  it('Should throw, extended auction lenght must be greater then auction lenght', async () => {
    const auctionData = {
      ...dummyAuctionData(nft.uid),
      extendedAuctionLength: 60000 * 3,
    };
    mockWalletReturnValue(walletSpy, memberAddress, auctionData);
    await expectThrow(testEnv.wrap(setForSaleNft)({}), WenError.invalid_params.key);
  });
});

describe('Should finalize bidding', () => {
  beforeEach(async () => {
    mockWalletReturnValue(walletSpy, memberAddress, dummyAuctionData(nft.uid));
    await testEnv.wrap(setForSaleNft)({});
    await wait(
      async () => (await build5Db().doc(`${COL.NFT}/${nft.uid}`).get<Nft>())?.available === 3,
    );
  });

  it.each([false, true])('Should bid and finalize it', async (noRoyaltySpace: boolean) => {
    if (noRoyaltySpace) {
      await build5Db()
        .doc(`${COL.COLLECTION}/${collection.uid}`)
        .update({ royaltiesSpace: '', royaltiesFee: 0 });
    }
    const bidOrder = await bidNft(members[0], MIN_IOTA_AMOUNT);
    expect(bidOrder.payload.restrictions.collection).toEqual({
      access: collection.access,
      accessAwards: collection.accessAwards || [],
      accessCollections: collection.accessCollections || [],
    });
    expect(bidOrder.payload.restrictions.nft).toEqual({
      saleAccess: nft.saleAccess || null,
      saleAccessMembers: nft.saleAccessMembers || [],
    });

    const nftData = <Nft>await build5Db().doc(`${COL.NFT}/${nft.uid}`).get();
    expect(nftData.auctionHighestBidder).toBe(members[0]);

    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${nftData.collection}`);
    collection = <Collection>await collectionDocRef.get();
    expect(collection.nftsOnAuction).toBe(1);

    await build5Db()
      .doc(`${COL.NFT}/${nft.uid}`)
      .update({ auctionTo: dateToTimestamp(dayjs().subtract(1, 'minute')) });

    await finalizeAllNftAuctions();

    const nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
    await wait(async () => {
      const updatedNft = <Nft>await nftDocRef.get();
      return updatedNft.available === NftAvailable.UNAVAILABLE;
    });
    const updatedNft = <Nft>await nftDocRef.get();
    expect(updatedNft.owner).toBe(members[0]);
    expect(updatedNft.auctionFrom).toBeNull();
    expect(updatedNft.auctionTo).toBeNull();

    const snap = await build5Db()
      .collection(COL.NOTIFICATION)
      .where('member', '==', members[0])
      .where('type', '==', NotificationType.WIN_BID)
      .get();
    expect(snap.length).toBe(1);

    collection = <Collection>await collectionDocRef.get();
    expect(collection.nftsOnAuction).toBe(0);
    expect(collection.lastTradedOn).toBeDefined();
    expect(collection.totalTrades).toBe(2);

    nft = <Nft>await nftDocRef.get();
    expect(nft.lastTradedOn).toBeDefined();
    expect(nft.totalTrades).toBe(2);

    const billPayments = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload.nft', '==', nft.uid)
      .get<Transaction>();
    for (const billPayment of billPayments) {
      expect(billPayment.payload.restrictions).toEqual(bidOrder.payload.restrictions);
    }
  });
});
