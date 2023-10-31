/* eslint-disable @typescript-eslint/no-explicit-any */
import { build5Db } from '@build-5/database';
import { COL, Nft, NftStatus, Transaction } from '@build-5/interfaces';
import { CollectionMintHelper } from './Helper';

describe('Collection minting', () => {
  const helper = new CollectionMintHelper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should unlock locked nft', async () => {
    let lockedNft = await helper.createLockedNft();
    await helper.mintCollection();
    const lockedNftOrder = <Transaction>(
      await build5Db().doc(`${COL.TRANSACTION}/${lockedNft.lockedBy}`).get()
    );
    expect(lockedNftOrder.payload.void).toBe(true);

    lockedNft = <Nft>await build5Db().doc(`${COL.NFT}/${lockedNft.uid}`).get();
    expect(lockedNft.locked).toBe(false);
    expect(lockedNft.lockedBy).toBe(null);
    expect(lockedNft.mintingData).toBeDefined();
    expect(lockedNft.status).toBe(NftStatus.MINTED);
  });
});
