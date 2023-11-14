import { build5Db } from '@build-5/database';
import {
  COL,
  Collection,
  CollectionType,
  MIN_IOTA_AMOUNT,
  Nft,
  UnsoldMintingOptions,
  WenError,
} from '@build-5/interfaces';
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

  it.each([CollectionType.GENERATED, CollectionType.SFT, CollectionType.CLASSIC])(
    'Should set new price',
    async (type: CollectionType) => {
      await build5Db().doc(`${COL.COLLECTION}/${helper.collection}`).update({ type });
      let nft = <Nft | undefined>await helper.createAndOrderNft();
      let collectionData = <Collection>(
        await build5Db().doc(`${COL.COLLECTION}/${helper.collection}`).get()
      );
      expect(collectionData.total).toBe(1);

      if (type === CollectionType.CLASSIC) {
        mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
          collection: helper.collection,
          network: helper.network,
          unsoldMintingOptions: UnsoldMintingOptions.SET_NEW_PRICE,
          price: 2 * MIN_IOTA_AMOUNT,
        });
        await expectThrow(testEnv.wrap(mintCollection)({}), WenError.invalid_collection_status.key);
        return;
      }
      await helper.mintCollection(UnsoldMintingOptions.SET_NEW_PRICE, 2 * MIN_IOTA_AMOUNT);

      collectionData = <Collection>(
        await build5Db().doc(`${COL.COLLECTION}/${helper.collection}`).get()
      );
      expect(collectionData.total).toBe(1);
      nft = <Nft>await build5Db()
        .doc(`${COL.NFT}/${nft?.uid}`)
        .get();
      expect(nft.availablePrice).toBe(2 * MIN_IOTA_AMOUNT);
      expect(nft.price).toBe(2 * MIN_IOTA_AMOUNT);
    },
  );

  it('Should throw, min price below mint iota', async () => {
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      collection: helper.collection,
      network: helper.network,
      unsoldMintingOptions: UnsoldMintingOptions.SET_NEW_PRICE,
      price: MIN_IOTA_AMOUNT / 2,
    });
    await expectThrow(testEnv.wrap(mintCollection)({}), WenError.invalid_params.key);
  });
});
