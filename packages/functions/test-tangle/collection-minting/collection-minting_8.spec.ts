import {
  COL,
  Collection,
  CollectionType,
  Nft,
  UnsoldMintingOptions,
  WenError,
} from '@soonaverse/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
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
    'Should set owner to guardian',
    async (type: CollectionType) => {
      await soonDb().doc(`${COL.COLLECTION}/${helper.collection}`).update({ type });
      let nft = <Nft | undefined>await helper.createAndOrderNft();
      let collectionData = <Collection>(
        await soonDb().doc(`${COL.COLLECTION}/${helper.collection}`).get()
      );
      expect(collectionData.total).toBe(1);
      expect(collectionData.sold).toBe(0);

      if (type !== CollectionType.CLASSIC) {
        mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
          collection: helper.collection,
          network: helper.network,
          unsoldMintingOptions: UnsoldMintingOptions.TAKE_OWNERSHIP,
        });
        await expectThrow(testEnv.wrap(mintCollection)({}), WenError.invalid_collection_status.key);
        return;
      }
      await helper.mintCollection(UnsoldMintingOptions.TAKE_OWNERSHIP);

      collectionData = <Collection>(
        await soonDb().doc(`${COL.COLLECTION}/${helper.collection}`).get()
      );
      expect(collectionData.total).toBe(1);
      nft = <Nft>await soonDb().doc(`${COL.NFT}/${nft?.uid}`).get();
      expect(nft.isOwned).toBe(true);
      expect(nft.owner).toBe(helper.guardian);
      expect(nft.sold).toBe(true);
      expect(collectionData.sold).toBe(1);
    },
  );
});
