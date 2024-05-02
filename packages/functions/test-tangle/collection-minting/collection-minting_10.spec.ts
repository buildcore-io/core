import { build5Db } from '@build-5/database';
import { COL, Nft } from '@build-5/interfaces';
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
    await build5Db().doc(COL.NFT, placeholderNft.uid).update({ placeholderNft: true });
    await build5Db()
      .doc(COL.COLLECTION, helper.collection)
      .update({ total: build5Db().inc(-1) });

    await helper.mintCollection();

    placeholderNft = <Nft>await build5Db().doc(COL.NFT, placeholderNft.uid).get();
    expect(placeholderNft.hidden).toBe(true);
  });
});
