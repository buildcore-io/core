import {
  COL,
  Nft,
  NftStatus,
  Transaction,
  TransactionMintCollectionType,
  TransactionType,
} from '@build5/interfaces';
import { isEmpty } from 'lodash';
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

  it('Should mint huge nfts', async () => {
    const count = 30;
    await soonDb().doc(`${COL.COLLECTION}/${helper.collection}`).update({ total: count });
    const promises = Array.from(Array(count)).map(() => {
      const nft = helper.createDummyNft(helper.collection!, helper.getRandomDescrptiron());
      return soonDb().doc(`${COL.NFT}/${nft.uid}`).create(nft);
    });
    await Promise.all(promises);
    await helper.mintCollection();

    const nftMintSnap = await soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.MINT_COLLECTION)
      .where('payload.type', '==', TransactionMintCollectionType.MINT_NFTS)
      .where('payload.collection', '==', helper.collection)
      .get<Transaction>();
    expect(nftMintSnap.length).toBeGreaterThan(1);
    expect(nftMintSnap.reduce((acc, act) => acc && act?.payload.amount > 0, true)).toBe(true);
    expect(nftMintSnap.reduce((acc, act) => acc && !isEmpty(act?.payload.nfts), true)).toBe(true);

    const nfts = (
      await soonDb().collection(COL.NFT).where('collection', '==', helper.collection).get()
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
