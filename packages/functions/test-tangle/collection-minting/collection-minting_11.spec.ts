import { COL, Nft, UnsoldMintingOptions } from '@build-5/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
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
      await soonDb().doc(`${COL.NFT}/${placeholderNft.uid}`).update({ placeholderNft: true });
      await soonDb()
        .doc(`${COL.COLLECTION}/${helper.collection}`)
        .update({ total: soonDb().inc(-1) });

      await helper.mintCollection(unsoldMintingOptions);

      placeholderNft = <Nft>await soonDb().doc(`${COL.NFT}/${placeholderNft.uid}`).get();
      expect(placeholderNft.hidden).toBe(true);
      nft = <Nft | undefined>await soonDb().doc(`${COL.NFT}/${nft.uid}`).get();
      if (unsoldMintingOptions === UnsoldMintingOptions.BURN_UNSOLD) {
        expect(nft).toBe(undefined);
      } else {
        expect(nft).toBeDefined();
      }
    },
  );
});
