/* eslint-disable @typescript-eslint/no-explicit-any */
import { IndexerPluginClient } from '@iota/iota.js-next';
import {
  COL,
  Nft,
  NftStatus,
  TransactionMintCollectionType,
  TransactionType,
} from '@soonaverse/interfaces';
import { isEmpty } from 'lodash';
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

  it('Should mint collection with many nfts', async () => {
    const count = 100;
    await admin.firestore().doc(`${COL.COLLECTION}/${helper.collection}`).update({ total: count });
    const promises = Array.from(Array(count)).map(() => {
      const nft = helper.createDummyNft(helper.collection!);
      return admin.firestore().doc(`${COL.NFT}/${nft.uid}`).create(nft);
    });
    await Promise.all(promises);

    await helper.mintCollection();

    const nftMintSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.MINT_COLLECTION)
      .where('payload.type', '==', TransactionMintCollectionType.MINT_NFTS)
      .where('payload.collection', '==', helper.collection)
      .get();
    expect(nftMintSnap.size).toBeGreaterThan(1);

    const nfts = (
      await admin.firestore().collection(COL.NFT).where('collection', '==', helper.collection).get()
    ).docs.map((d) => <Nft>d.data());
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

    const indexer = new IndexerPluginClient(helper.walletService?.client!);

    const nftPromises = nfts.map(async (nft) => {
      try {
        const outputId = (await indexer.nft(nft.mintingData?.nftId!)).items[0];
        const nftOutput = (await helper.walletService!.client.output(outputId)).output;
        return nftOutput !== undefined;
      } catch {
        return false;
      }
    });
    const allNftIdsAreValid = (await Promise.all(nftPromises)).reduce(
      (acc, act) => acc && act,
      true,
    );
    expect(allNftIdsAreValid).toBe(true);
  });

  afterAll(async () => {
    await helper.afterAll();
  });
});
