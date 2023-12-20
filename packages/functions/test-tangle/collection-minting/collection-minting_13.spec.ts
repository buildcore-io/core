/* eslint-disable @typescript-eslint/no-explicit-any */
import { build5Db } from '@build-5/database';
import { COL, Collection, CollectionStatus, Nft } from '@build-5/interfaces';
import { NftOutput } from '@iota/sdk';
import { createCollection } from '../../src/runtime/firebase/collection';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { CollectionMintHelper, getNftMetadata } from './Helper';

describe('Collection minting', () => {
  const helper = new CollectionMintHelper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should mint without royalty space', async () => {
    const dummyCollection = helper.createDummyCollection(helper.space!.uid);
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, dummyCollection);
    helper.collection = (await testEnv.wrap(createCollection)({})).uid;

    let nft = await helper.createAndOrderNft();
    await helper.mintCollection();

    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${helper.collection}`);

    await wait(async () => {
      const collection = await collectionDocRef.get<Collection>();
      return collection?.status === CollectionStatus.MINTED;
    });
    const collection = await collectionDocRef.get<Collection>();

    const client = helper.walletService?.client!;
    const collectionOutputId = await client.nftOutputId(collection?.mintingData?.nftId!);
    const collectionOutput = (await client.getOutput(collectionOutputId)).output;
    const collectionMetadata = getNftMetadata(collectionOutput as NftOutput);
    expect(collectionMetadata.royalties).toEqual({});

    const nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
    nft = <Nft>await nftDocRef.get();
    const nftOutputId = await client.nftOutputId(nft.mintingData?.nftId!);
    const nftOutput = (await client.getOutput(nftOutputId)).output;
    const nftMetadata = getNftMetadata(nftOutput as NftOutput);
    expect(nftMetadata.royalties).toEqual({});
  });
});
