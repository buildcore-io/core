import { COL, Nft } from '@build5/interfaces';
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

  it('Should hide placeholder nft, all are sold before mint', async () => {
    await helper.createAndOrderNft(true, true);
    let placeholderNft = await helper.createAndOrderNft(true, false);
    await soonDb().doc(`${COL.NFT}/${placeholderNft.uid}`).update({ placeholderNft: true });
    await soonDb()
      .doc(`${COL.COLLECTION}/${helper.collection}`)
      .update({ total: soonDb().inc(-1) });

    await helper.mintCollection();

    placeholderNft = <Nft>await soonDb().doc(`${COL.NFT}/${placeholderNft.uid}`).get();
    expect(placeholderNft.hidden).toBe(true);
  });
});
