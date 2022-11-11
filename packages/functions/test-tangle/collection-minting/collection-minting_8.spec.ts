import {
  COL,
  Collection,
  CollectionType,
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
    'Should set owner to guardian',
    async (type: CollectionType) => {
      await admin.firestore().doc(`${COL.COLLECTION}/${helper.collection}`).update({ type });
      let nft = <Nft | undefined>await helper.createAndOrderNft();
      let collectionData = <Collection>(
        (await admin.firestore().doc(`${COL.COLLECTION}/${helper.collection}`).get()).data()
      );
      expect(collectionData.total).toBe(1);
      expect(collectionData.sold).toBe(0);

      if (type !== CollectionType.CLASSIC) {
        mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
          collection: helper.collection,
          network: helper.network,
          unsoldMintingOptions: UnsoldMintingOptions.TAKE_OWNERSHIP,
        });
        await expectThrow(
          testEnv.wrap(mintCollectionOrder)({}),
          WenError.invalid_collection_status.key,
        );
        return;
      }
      await helper.mintCollection(UnsoldMintingOptions.TAKE_OWNERSHIP);

      collectionData = <Collection>(
        (await admin.firestore().doc(`${COL.COLLECTION}/${helper.collection}`).get()).data()
      );
      expect(collectionData.total).toBe(1);
      nft = <Nft>(await admin.firestore().doc(`${COL.NFT}/${nft?.uid}`).get()).data();
      expect(nft.isOwned).toBe(true);
      expect(nft.owner).toBe(helper.guardian);
      expect(nft.sold).toBe(true);
      expect(collectionData.sold).toBe(1);
    },
  );
});
