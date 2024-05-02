/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
import {
  COL,
  Collection,
  KEY_NAME_TANGLE,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  NftStatus,
  Space,
  Transaction,
  TransactionType,
} from '@buildcore/interfaces';
import { NftOutput } from '@iota/sdk';
import { getAddress } from '../../src/utils/address.utils';
import { EMPTY_NFT_ID } from '../../src/utils/collection-minting-utils/nft.utils';
import { CollectionMintHelper, getNftMetadata } from './Helper';

describe('Collection minting', () => {
  const helper = new CollectionMintHelper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should mint, cancel active sells, not mint placeholder', async () => {
    await helper.createAndOrderNft();
    await helper.createAndOrderNft(true);
    await helper.createAndOrderNft(true, true);
    let placeholderNft = await helper.createAndOrderNft(true, false);
    await database().doc(COL.NFT, placeholderNft.uid).update({ placeholderNft: true });

    const collectionDocRef = database().doc(COL.COLLECTION, helper.collection);
    await collectionDocRef.update({ total: database().inc(-1), limitedEdition: true });

    await helper.mintCollection();
    await helper.lockCollectionConfirmed();

    let collection = <Collection>await collectionDocRef.get();
    const outputId = await helper.walletService!.client.nftOutputId(collection.mintingData?.nftId!);
    const output = <NftOutput>(await helper.walletService!.client.getOutput(outputId)).output;
    expect((output.unlockConditions[0] as any).address.pubKeyHash).toBe(EMPTY_NFT_ID);

    const bidCredit = (
      await database()
        .collection(COL.TRANSACTION)
        .where('payload_collection', '==', helper.collection)
        .where('type', '==', TransactionType.CREDIT)
        .get()
    ).map((d) => <Transaction>d);
    expect(bidCredit.length).toBe(1);
    expect(bidCredit[0].payload.amount).toBe(2 * MIN_IOTA_AMOUNT);

    const nftsQuery = database()
      .collection(COL.NFT)
      .where('collection', '==', helper.collection)
      .where('placeholderNft', '==', false);
    const nfts = (await nftsQuery.get()).map((d) => <Nft>d);
    const allCancelled = nfts.reduce(
      (acc, act) =>
        acc &&
        act.auctionFrom === undefined &&
        act.auctionTo === undefined &&
        act.auctionFloorPrice === undefined &&
        act.auctionLength === undefined &&
        act.auctionHighestBid === undefined &&
        act.auctionHighestBidder === undefined &&
        (!act.sold || (act.availableFrom === undefined && act.availablePrice === undefined)),
      true,
    );
    expect(allCancelled).toBe(true);

    collection = <Collection>await collectionDocRef.get();
    const royaltySpace = <Space>await database().doc(COL.SPACE, collection.royaltiesSpace!).get();

    const collectionOutput = await helper.nftWallet!.getNftOutputs(
      collection.mintingData?.nftId,
      undefined,
    );
    expect(Object.keys(collectionOutput).length).toBe(1);
    const collectionMetadata = getNftMetadata(Object.values(collectionOutput)[0]);
    expect(collectionMetadata.standard).toBe('IRC27');
    expect(collectionMetadata.version).toBe('v1.0');
    expect(collectionMetadata.type).toBe('image/png');
    expect(collectionMetadata.uri).toBe(`ipfs://${collection.ipfsMedia}`);
    expect(collectionMetadata.description).toBe(collection.description);
    expect(collectionMetadata.issuerName).toBe(KEY_NAME_TANGLE);
    expect(collectionMetadata.royalties[getAddress(royaltySpace, Network.RMS)]).toBe(
      collection.royaltiesFee,
    );
    expect(collectionMetadata.originId).toBe(collection.uid);

    for (const nft of nfts) {
      const nftOutputs = await helper.nftWallet!.getNftOutputs(nft.mintingData?.nftId, undefined);
      expect(Object.keys(nftOutputs).length).toBe(1);
      const metadata = getNftMetadata(Object.values(nftOutputs)[0]);
      expect(metadata.standard).toBe('IRC27');
      expect(metadata.version).toBe('v1.0');
      expect(metadata.type).toBe('image/png');
      expect(metadata.uri).toBe(`ipfs://${nft.ipfsMedia}`);
      expect(metadata.name).toBe(nft.name);
      expect(metadata.description).toBe(nft.description);
      expect(metadata.issuerName).toBe(KEY_NAME_TANGLE);
      expect(metadata.collectionId).toBe(collection.mintingData?.nftId);
      expect(metadata.collectionName).toBe(collection.name);
      expect(metadata.royalties[getAddress(royaltySpace, Network.RMS)]).toBe(
        collection.royaltiesFee,
      );
      expect(metadata.originId).toBe(nft.uid);
    }

    placeholderNft = <Nft>await database().doc(COL.NFT, placeholderNft.uid).get();
    expect(placeholderNft.status).toBe(NftStatus.PRE_MINTED);
  });
});
