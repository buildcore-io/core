import { database } from '@buildcore/database';
import { COL, Collection, Nft, UnsoldMintingOptions } from '@buildcore/interfaces';
import { CollectionMintHelper } from './Helper';

describe('Collection minting', () => {
  const helper = new CollectionMintHelper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it.each([UnsoldMintingOptions.BURN_UNSOLD, UnsoldMintingOptions.KEEP_PRICE])(
    'Should burn unsold nfts',
    async (unsoldMintingOptions: UnsoldMintingOptions) => {
      await helper.createAndOrderNft(true);
      let nft = <Nft | undefined>await helper.createAndOrderNft();
      let collectionData = <Collection>(
        await database().doc(COL.COLLECTION, helper.collection).get()
      );
      expect(collectionData.total).toBe(2);

      await helper.mintCollection(unsoldMintingOptions);

      collectionData = <Collection>await database().doc(COL.COLLECTION, helper.collection).get();
      expect(collectionData.total).toBe(
        unsoldMintingOptions === UnsoldMintingOptions.BURN_UNSOLD ? 1 : 2,
      );
      nft = <Nft | undefined>await database().doc(COL.NFT, nft?.uid!).get();
      expect(nft === undefined).toBe(unsoldMintingOptions === UnsoldMintingOptions.BURN_UNSOLD);
    },
  );
});
