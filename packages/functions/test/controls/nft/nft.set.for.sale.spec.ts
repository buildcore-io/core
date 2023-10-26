import { build5Db } from '@build-5/database';
import { COL, Collection, Nft, WenError } from '@build-5/interfaces';
import { setForSaleNft } from '../../../src/runtime/firebase/nft';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';
import { testEnv } from '../../set-up';
import { expectThrow, mockWalletReturnValue, wait } from '../common';
import { Helper, dummyAuctionData, dummySaleData } from './Helper';

describe('Nft set for sale', () => {
  const h = new Helper();

  beforeAll(async () => {
    await h.beforeAll();
  });

  beforeEach(async () => {
    await h.beforeEach();
  });

  it('Should set nft for sale', async () => {
    mockWalletReturnValue(h.spy, h.member, dummySaleData(h.nft.uid));
    await testEnv.wrap(setForSaleNft)({});

    const nftDocRef = build5Db().doc(`${COL.NFT}/${h.nft.uid}`);
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
    const nftDocRef = build5Db().doc(`${COL.NFT}/${h.nft.uid}`);
    await nftDocRef.update({ setAsAvatar: true });

    mockWalletReturnValue(h.spy, h.member, dummySaleData(h.nft.uid));
    await expectThrow(testEnv.wrap(setForSaleNft)({}), WenError.nft_set_as_avatar.key);
  });

  it('Should set nft for auction', async () => {
    mockWalletReturnValue(h.spy, h.member, dummyAuctionData(h.nft.uid));
    await testEnv.wrap(setForSaleNft)({});

    const nftDocRef = build5Db().doc(`${COL.NFT}/${h.nft.uid}`);
    await wait(async () => {
      const nft = <Nft>await nftDocRef.get();
      return nft.available === 3;
    });

    const auctionNft = <Nft>await build5Db().doc(`${COL.NFT}/${h.nft.uid}`).get();
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
    mockWalletReturnValue(h.spy, h.member, dummyAuctionData(h.nft.uid));
    await testEnv.wrap(setForSaleNft)({});
    mockWalletReturnValue(h.spy, h.member, dummyAuctionData(h.nft.uid));
    await expectThrow(testEnv.wrap(setForSaleNft)({}), WenError.auction_already_in_progress.key);
  });

  it('Should throw, invalid nft', async () => {
    mockWalletReturnValue(h.spy, h.member, {
      ...dummyAuctionData(h.nft.uid),
      nft: getRandomEthAddress(),
    });
    await expectThrow(testEnv.wrap(setForSaleNft)({}), WenError.nft_does_not_exists.key);
  });

  it('Should throw, not owner', async () => {
    mockWalletReturnValue(h.spy, h.members[0], dummyAuctionData(h.nft.uid));
    await expectThrow(testEnv.wrap(setForSaleNft)({}), WenError.you_must_be_the_owner_of_nft.key);
  });
});
