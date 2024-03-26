import { build5Db } from '@build-5/database';
import {
  COL,
  Nft,
  NftStatus,
  SOON_PROJECT_ID,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import { isEmpty } from 'lodash';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { CollectionMintHelper } from './Helper';

describe('Collection minting', () => {
  const helper = new CollectionMintHelper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should mint huge nfts', async () => {
    const count = 30;
    await build5Db().doc(COL.COLLECTION, helper.collection).update({ total: count });
    const promises = Array.from(Array(count)).map(async () => {
      const nft = helper.createDummyNft(helper.collection!, helper.getRandomDescrptiron());
      await build5Db()
        .doc(COL.NFT, nft.uid)
        .create({
          ...nft,
          availableFrom: dateToTimestamp(nft.availableFrom),
          project: SOON_PROJECT_ID,
        } as any);
      return (await build5Db().doc(COL.NFT, nft.uid).get())!;
    });
    await Promise.all(promises);
    await helper.mintCollection();

    const nftMintSnap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.MINT_COLLECTION)
      .where('payload_type', '==', TransactionPayloadType.MINT_NFTS)
      .where('payload_collection', '==', helper.collection)
      .get();
    expect(nftMintSnap.length).toBeGreaterThan(1);
    expect(nftMintSnap.reduce((acc, act) => acc && act?.payload.amount! > 0, true)).toBe(true);
    expect(nftMintSnap.reduce((acc, act) => acc && !isEmpty(act?.payload.nfts), true)).toBe(true);

    const nfts = (
      await build5Db().collection(COL.NFT).where('collection', '==', helper.collection).get()
    ).map((d) => <Nft>d);
    const allMinted = nfts.reduce((acc, act) => acc && act.status === NftStatus.MINTED, true);
    expect(allMinted).toBe(true);
    const allMintedByGuardian = nfts.reduce(
      (acc, act) => acc && act.mintingData?.mintedBy === helper.guardian,
      true,
    );
    expect(allMintedByGuardian).toBe(true);
    const allHaveAddress = nfts.reduce(
      (acc, act) => acc && !isEmpty(act.mintingData?.address),
      true,
    );
    expect(allHaveAddress).toBe(true);
    const allHaveStorageDepositSaved = nfts.reduce(
      (acc, act) => acc && act.mintingData?.storageDeposit !== undefined,
      true,
    );
    expect(allHaveStorageDepositSaved).toBe(true);
  });
});
