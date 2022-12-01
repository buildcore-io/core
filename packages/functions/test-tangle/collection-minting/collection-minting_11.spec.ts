import { COL, Nft, UnsoldMintingOptions } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
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
      await admin
        .firestore()
        .doc(`${COL.NFT}/${placeholderNft.uid}`)
        .update({ placeholderNft: true });
      await admin
        .firestore()
        .doc(`${COL.COLLECTION}/${helper.collection}`)
        .update({ total: admin.firestore.FieldValue.increment(-1) });

      await helper.mintCollection(unsoldMintingOptions);

      placeholderNft = <Nft>(
        (await admin.firestore().doc(`${COL.NFT}/${placeholderNft.uid}`).get()).data()
      );
      expect(placeholderNft.hidden).toBe(true);
      nft = <Nft | undefined>(await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).get()).data();
      if (unsoldMintingOptions === UnsoldMintingOptions.BURN_UNSOLD) {
        expect(nft).toBe(undefined);
      } else {
        expect(nft).toBeDefined();
      }
    },
  );
});
