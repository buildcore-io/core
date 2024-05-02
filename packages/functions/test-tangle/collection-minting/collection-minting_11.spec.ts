import { database } from '@buildcore/database';
import { COL, Nft, UnsoldMintingOptions } from '@buildcore/interfaces';
import { CollectionMintHelper } from './Helper';

describe('Collection minting', () => {
  const helper = new CollectionMintHelper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it.each([UnsoldMintingOptions.BURN_UNSOLD, UnsoldMintingOptions.TAKE_OWNERSHIP])(
    'Should hide placeholder nft, all are burned or taken ownership',
    async (unsoldMintingOptions: UnsoldMintingOptions) => {
      await helper.createAndOrderNft(true, true);
      let nft: Nft | undefined = await helper.createAndOrderNft();
      let placeholderNft = await helper.createAndOrderNft(true, false);
      await database().doc(COL.NFT, placeholderNft.uid).update({ placeholderNft: true });
      await database()
        .doc(COL.COLLECTION, helper.collection)
        .update({ total: database().inc(-1) });

      await helper.mintCollection(unsoldMintingOptions);

      placeholderNft = <Nft>await database().doc(COL.NFT, placeholderNft.uid).get();
      expect(placeholderNft.hidden).toBe(true);
      nft = <Nft | undefined>await database().doc(COL.NFT, nft.uid).get();
      if (unsoldMintingOptions === UnsoldMintingOptions.BURN_UNSOLD) {
        expect(nft).toBe(undefined);
      } else {
        expect(nft).toBeDefined();
      }
    },
  );
});
