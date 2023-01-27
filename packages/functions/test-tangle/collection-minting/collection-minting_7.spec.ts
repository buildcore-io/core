import {
  COL,
  Collection,
  CollectionType,
  MIN_IOTA_AMOUNT,
  Nft,
  UnsoldMintingOptions,
  WenError,
} from '@soonaverse/interfaces';
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

  it.each([CollectionType.GENERATED, CollectionType.SFT, CollectionType.CLASSIC])(
    'Should set new price',
    async (type: CollectionType) => {
      await admin.firestore().doc(`${COL.COLLECTION}/${helper.collection}`).update({ type });
      let nft = <Nft | undefined>await helper.createAndOrderNft();
      let collectionData = <Collection>(
        (await admin.firestore().doc(`${COL.COLLECTION}/${helper.collection}`).get()).data()
      );
      expect(collectionData.total).toBe(1);

      if (type === CollectionType.CLASSIC) {
        mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
          collection: helper.collection,
          network: helper.network,
          unsoldMintingOptions: UnsoldMintingOptions.SET_NEW_PRICE,
          price: 2 * MIN_IOTA_AMOUNT,
        });
        await expectThrow(
          testEnv.wrap(mintCollectionOrder)({}),
          WenError.invalid_collection_status.key,
        );
        return;
      }
      await helper.mintCollection(UnsoldMintingOptions.SET_NEW_PRICE, 2 * MIN_IOTA_AMOUNT);

      collectionData = <Collection>(
        (await admin.firestore().doc(`${COL.COLLECTION}/${helper.collection}`).get()).data()
      );
      expect(collectionData.total).toBe(1);
      nft = <Nft>(await admin.firestore().doc(`${COL.NFT}/${nft?.uid}`).get()).data();
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
    await expectThrow(testEnv.wrap(mintCollectionOrder)({}), WenError.invalid_params.key);
  });
});
