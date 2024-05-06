/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
import { COL, NftStatus, Transaction } from '@buildcore/interfaces';
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
      await database().doc(COL.TRANSACTION, lockedNft.lockedBy!).get()
    );
    expect(lockedNftOrder.payload.void).toBe(true);

    lockedNft = (await database().doc(COL.NFT, lockedNft.uid).get())!;
    expect(lockedNft.locked).toBe(false);
    expect(lockedNft.lockedBy).toBe(undefined);
    expect(lockedNft.mintingData).toBeDefined();
    expect(lockedNft.status).toBe(NftStatus.MINTED);
  });
});
