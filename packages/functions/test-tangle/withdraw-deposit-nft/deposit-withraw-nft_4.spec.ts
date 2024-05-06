/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
import { COL, WEN_FUNC, WenError } from '@buildcore/interfaces';
import { expectThrow } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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
    mockWalletReturnValue(helper.guardian!, { nft: helper.nft!.uid });
    await expectThrow(testEnv.wrap(WEN_FUNC.withdrawNft), WenError.nft_on_sale.key);

    await database().doc(COL.NFT, helper.nft!.uid).update({
      auctionFrom: undefined,
      auctionTo: undefined,
      auctionFloorPrice: undefined,
      auctionLength: undefined,
      auctionHighestBid: undefined,
      auctionHighestBidder: undefined,
    });

    await helper.setAvailableForAuction();
    mockWalletReturnValue(helper.guardian!, { nft: helper.nft!.uid });
    await expectThrow(testEnv.wrap(WEN_FUNC.withdrawNft), WenError.nft_on_sale.key);
  });
});
