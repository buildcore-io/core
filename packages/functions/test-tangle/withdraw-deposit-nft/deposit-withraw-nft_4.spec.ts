/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, WenError } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { withdrawNft } from '../../src/controls/nft/nft.control';
import { expectThrow, mockWalletReturnValue } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Collection minting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should throw, can not withraw nft during auction or sale.', async () => {
    await helper.createAndOrderNft();
    await helper.mintCollection();

    await helper.setAvailableForSale();
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { nft: helper.nft!.uid });
    await expectThrow(testEnv.wrap(withdrawNft)({}), WenError.nft_on_sale.key);

    await admin.firestore().doc(`${COL.NFT}/${helper.nft!.uid}`).update({
      auctionFrom: null,
      auctionTo: null,
      auctionFloorPrice: null,
      auctionLength: null,
      auctionHighestBid: null,
      auctionHighestBidder: null,
      auctionHighestTransaction: null,
    });

    await helper.setAvailableForAuction();
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { nft: helper.nft!.uid });
    await expectThrow(testEnv.wrap(withdrawNft)({}), WenError.nft_on_sale.key);
  });

  afterAll(async () => {
    await helper.listenerRMS!.cancel();
  });
});
