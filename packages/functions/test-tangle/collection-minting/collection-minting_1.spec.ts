import { UnsoldMintingOptions, WenError } from '@build-5/interfaces';
import { mintCollection } from '../../src/runtime/firebase/collection/index';
import { expectThrow, mockWalletReturnValue } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { CollectionMintHelper } from './Helper';

describe('Collection minting', () => {
  const helper = new CollectionMintHelper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should throw, no nfts', async () => {
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      collection: helper.collection,
      network: helper.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    await expectThrow(testEnv.wrap(mintCollection)({}), WenError.no_nfts_to_mint.key);
  });

  it('Should throw, all nfts will be burned', async () => {
    await helper.createAndOrderNft();
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      collection: helper.collection,
      network: helper.network,
      unsoldMintingOptions: UnsoldMintingOptions.BURN_UNSOLD,
    });
    await expectThrow(testEnv.wrap(mintCollection)({}), WenError.no_nfts_to_mint.key);
  });
});
