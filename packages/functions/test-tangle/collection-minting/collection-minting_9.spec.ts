import { build5Db } from '@build-5/database';
import { COL, Transaction, UnsoldMintingOptions, WEN_FUNC, WenError } from '@build-5/interfaces';
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

  it('Should throw, member has no valid address', async () => {
    await build5Db()
      .doc(COL.MEMBER, helper.guardian)
      .update({ rmsAddress: '', smrAddress: '', iotaAddress: '', atoiAddress: '' });
    mockWalletReturnValue(helper.guardian!, {
      collection: helper.collection,
      network: helper.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.mintCollection),
      WenError.member_must_have_validated_address.key,
    );
  });

  it('Should throw, space has no valid address', async () => {
    await build5Db()
      .doc(COL.SPACE, helper.space!.uid)
      .update({ rmsAddress: '', smrAddress: '', iotaAddress: '', atoiAddress: '' });
    mockWalletReturnValue(helper.guardian!, {
      collection: helper.collection,
      network: helper.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.mintCollection),
      WenError.space_must_have_validated_address.key,
    );
  });

  it('Should throw, royalty space has no valid address', async () => {
    await build5Db()
      .doc(COL.SPACE, helper.royaltySpace!.uid)
      .update({ rmsAddress: '', smrAddress: '', iotaAddress: '', atoiAddress: '' });
    mockWalletReturnValue(helper.guardian!, {
      collection: helper.collection,
      network: helper.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.mintCollection),
      WenError.space_must_have_validated_address.key,
    );
  });
});
