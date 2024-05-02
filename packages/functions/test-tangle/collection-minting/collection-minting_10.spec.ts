import { database } from '@buildcore/database';
import { COL, Nft } from '@buildcore/interfaces';
import { CollectionMintHelper } from './Helper';

describe('Collection minting', () => {
  const helper = new CollectionMintHelper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should hide placeholder nft, all are sold before mint', async () => {
    await helper.createAndOrderNft(true, true);
    let placeholderNft = await helper.createAndOrderNft(true, false);
    await database().doc(COL.NFT, placeholderNft.uid).update({ placeholderNft: true });
    await database()
      .doc(COL.COLLECTION, helper.collection)
      .update({ total: database().inc(-1) });

    await helper.mintCollection();

    placeholderNft = <Nft>await database().doc(COL.NFT, placeholderNft.uid).get();
    expect(placeholderNft.hidden).toBe(true);
  });
});
