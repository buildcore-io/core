import { COL, Nft } from '@build-5/interfaces';
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

  it('Should not hide placeholder nft', async () => {
    await helper.createAndOrderNft(true, true);
    let nft: Nft | undefined = await helper.createAndOrderNft();
    let placeholderNft = await helper.createAndOrderNft(true, false);
    await soonDb().doc(`${COL.NFT}/${placeholderNft.uid}`).update({ placeholderNft: true });
    await soonDb()
      .doc(`${COL.COLLECTION}/${helper.collection}`)
      .update({ total: soonDb().inc(-1) });

    await helper.mintCollection();

    placeholderNft = <Nft>await soonDb().doc(`${COL.NFT}/${placeholderNft.uid}`).get();
    expect(placeholderNft.hidden).toBe(false);
    nft = <Nft | undefined>await soonDb().doc(`${COL.NFT}/${nft.uid}`).get();
    expect(nft).toBeDefined();
  });
});
