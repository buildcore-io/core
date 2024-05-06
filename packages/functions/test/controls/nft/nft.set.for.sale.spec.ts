import { database } from '@buildcore/database';
import { COL, Collection, Nft, WEN_FUNC, WenError } from '@buildcore/interfaces';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';
import { mockWalletReturnValue, testEnv } from '../../set-up';
import { expectThrow, wait } from '../common';
import { Helper, dummyAuctionData, dummySaleData } from './Helper';

describe('Nft set for sale', () => {
  const h = new Helper();

  beforeEach(async () => {
    await h.beforeEach();
  });

  it('Should set nft for sale', async () => {
    mockWalletReturnValue(h.member, dummySaleData(h.nft.uid));
    await testEnv.wrap(WEN_FUNC.setForSaleNft);

    const nftDocRef = database().doc(COL.NFT, h.nft.uid);
    await wait(async () => {
      const nft = <Nft>await nftDocRef.get();
      return nft.available === 1;
    });

    const saleNft = <Nft>await nftDocRef.get();
    expect(saleNft.available).toBe(1);
    expect(saleNft.availableFrom).toBeDefined();

    const collectionDocRef = database().doc(COL.COLLECTION, saleNft.collection);
    const collection = <Collection>await collectionDocRef.get();
    expect(collection.nftsOnAuction).toBe(0);
    expect(collection.nftsOnSale).toBe(1);
  });

  it('Should throw, nft set as avatar', async () => {
    const nftDocRef = database().doc(COL.NFT, h.nft.uid);
    await nftDocRef.update({ setAsAvatar: true });
    mockWalletReturnValue(h.member, dummySaleData(h.nft.uid));
    await expectThrow(testEnv.wrap(WEN_FUNC.setForSaleNft), WenError.nft_set_as_avatar.key);
  });

  it('Should set nft for auction', async () => {
    mockWalletReturnValue(h.member, dummyAuctionData(h.nft.uid));
    await testEnv.wrap(WEN_FUNC.setForSaleNft);

    const nftDocRef = database().doc(COL.NFT, h.nft.uid);
    await wait(async () => {
      const nft = <Nft>await nftDocRef.get();
      return nft.available === 3;
    });

    const auctionNft = <Nft>await database().doc(COL.NFT, h.nft.uid).get();
    expect(auctionNft.available).toBe(3);
    expect(auctionNft.auctionFrom).toBeDefined();
    expect(auctionNft.auctionTo).toBeDefined();
    expect(auctionNft.auctionLength).toBeDefined();

    const collectionDocRef = database().doc(COL.COLLECTION, auctionNft.collection);
    const collection = <Collection>await collectionDocRef.get();
    expect(collection.nftsOnAuction).toBe(1);
    expect(collection.nftsOnSale).toBe(1);
  });

  it('Should throw, auction already in progress', async () => {
    mockWalletReturnValue(h.member, dummyAuctionData(h.nft.uid));
    await testEnv.wrap(WEN_FUNC.setForSaleNft);
    mockWalletReturnValue(h.member, dummyAuctionData(h.nft.uid));
    await expectThrow(
      testEnv.wrap(WEN_FUNC.setForSaleNft),
      WenError.auction_already_in_progress.key,
    );
  });

  it('Should throw, invalid nft', async () => {
    mockWalletReturnValue(h.member, { ...dummyAuctionData(h.nft.uid), nft: getRandomEthAddress() });
    await expectThrow(testEnv.wrap(WEN_FUNC.setForSaleNft), WenError.nft_does_not_exists.key);
  });

  it('Should throw, not owner', async () => {
    mockWalletReturnValue(h.members[0], dummyAuctionData(h.nft.uid));
    await expectThrow(
      testEnv.wrap(WEN_FUNC.setForSaleNft),
      WenError.you_must_be_the_owner_of_nft.key,
    );
  });
});
