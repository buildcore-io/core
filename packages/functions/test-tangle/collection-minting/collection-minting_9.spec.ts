import { COL, UnsoldMintingOptions, WenError } from '@soon/interfaces';
import admin from '../../src/admin.config';
import { mintCollectionOrder } from '../../src/controls/nft/collection-mint.control';
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

  it('Should throw, member has no valid address', async () => {
    await admin
      .firestore()
      .doc(`${COL.MEMBER}/${helper.guardian}`)
      .update({ validatedAddress: {} });
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      collection: helper.collection,
      network: helper.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    await expectThrow(
      testEnv.wrap(mintCollectionOrder)({}),
      WenError.member_must_have_validated_address.key,
    );
  });

  it('Should throw, space has no valid address', async () => {
    await admin
      .firestore()
      .doc(`${COL.SPACE}/${helper.space!.uid}`)
      .update({ validatedAddress: {} });
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      collection: helper.collection,
      network: helper.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    await expectThrow(
      testEnv.wrap(mintCollectionOrder)({}),
      WenError.space_must_have_validated_address.key,
    );
  });

  it('Should throw, royalty space has no valid address', async () => {
    await admin
      .firestore()
      .doc(`${COL.SPACE}/${helper.royaltySpace!.uid}`)
      .update({ validatedAddress: {} });
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      collection: helper.collection,
      network: helper.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    await expectThrow(
      testEnv.wrap(mintCollectionOrder)({}),
      WenError.space_must_have_validated_address.key,
    );
  });

  afterAll(async () => {
    await helper.afterAll();
  });
});
