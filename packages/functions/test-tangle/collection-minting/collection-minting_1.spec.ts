import { Transaction, UnsoldMintingOptions, WEN_FUNC, WenError } from '@buildcore/interfaces';
import { expectThrow } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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
    mockWalletReturnValue(helper.guardian!, {
      collection: helper.collection,
      network: helper.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.mintCollection),
      WenError.no_nfts_to_mint.key,
    );
  });

  it('Should throw, all nfts will be burned', async () => {
    await helper.createAndOrderNft();
    mockWalletReturnValue(helper.guardian!, {
      collection: helper.collection,
      network: helper.network,
      unsoldMintingOptions: UnsoldMintingOptions.BURN_UNSOLD,
    });
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.mintCollection),
      WenError.no_nfts_to_mint.key,
    );
  });
});
