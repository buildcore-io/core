/* eslint-disable @typescript-eslint/no-explicit-any */
import { IndexerPluginClient, INftOutput } from '@iota/iota.js-next';
import {
  COL,
  Collection,
  DEFAULT_NETWORK,
  KEY_NAME_TANGLE,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  NftStatus,
  Space,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
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

  it.each([false, true])(
    'Should mint, cancel active sells, not mint placeholder',
    async (limited: boolean) => {
      await helper.createAndOrderNft();
      await helper.createAndOrderNft(true);
      const nft = await helper.createAndOrderNft(true, true);
      let placeholderNft = await helper.createAndOrderNft(true, false);
      await soonDb().doc(`${COL.NFT}/${placeholderNft.uid}`).update({ placeholderNft: true });
      await soonDb()
        .doc(`${COL.COLLECTION}/${helper.collection}`)
        .update({ total: soonDb().inc(-1) });

      if (limited) {
        await soonDb()
          .doc(`${COL.COLLECTION}/${helper.collection}`)
          .update({ limitedEdition: limited });
      }
      await helper.mintCollection();
      if (limited) {
        await helper.lockCollectionConfirmed();
        const indexer = new IndexerPluginClient(helper.walletService?.client!);
        const collection = <Collection>(
          await soonDb().doc(`${COL.COLLECTION}/${helper.collection}`).get()
        );
        const outputId = (await indexer.nft(collection.mintingData?.nftId!)).items[0];
        const output = <INftOutput>(await helper.walletService!.client.output(outputId)).output;
        expect((output.unlockConditions[0] as any).address.pubKeyHash).toBe(EMPTY_NFT_ID);
      }

      const bidCredit = (
        await soonDb()
          .collection(COL.TRANSACTION)
          .where('payload.collection', '==', helper.collection)
          .where('type', '==', TransactionType.CREDIT)
          .get()
      ).map((d) => <Transaction>d);
      expect(bidCredit.length).toBe(1);
      expect(bidCredit[0].payload.amount).toBe(2 * MIN_IOTA_AMOUNT);
      const bidder = <Member>await soonDb().doc(`${COL.MEMBER}/${helper.member}`).get();
      const order = <Transaction>(
        await soonDb().doc(`${COL.TRANSACTION}/${nft.auctionHighestTransaction}`).get()
      );
      expect(bidCredit[0].payload.targetAddress).toBe(getAddress(bidder, DEFAULT_NETWORK));
      expect(bidCredit[0].payload.sourceAddress).toBe(order.payload.targetAddress);

      const nftsQuery = soonDb()
        .collection(COL.NFT)
        .where('collection', '==', helper.collection)
        .where('placeholderNft', '==', false);
      const nfts = (await nftsQuery.get()).map((d) => <Nft>d);
      const allCancelled = nfts.reduce(
        (acc, act) =>
          acc &&
          act.auctionFrom === null &&
          act.auctionTo === null &&
          act.auctionFloorPrice === null &&
          act.auctionLength === null &&
          act.auctionHighestBid === null &&
          act.auctionHighestBidder === null &&
          act.auctionHighestTransaction === null &&
          (!act.sold || (act.availableFrom === null && act.availablePrice === null)),
        true,
      );
      expect(allCancelled).toBe(true);

      const collection = <Collection>(
        await soonDb().doc(`${COL.COLLECTION}/${helper.collection}`).get()
      );
      const royaltySpace = <Space>(
        await soonDb().doc(`${COL.SPACE}/${collection.royaltiesSpace}`).get()
      );

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
      expect(collectionMetadata.soonaverseId).toBe(collection.uid);

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
        expect(metadata.soonaverseId).toBe(nft.uid);
      }

      placeholderNft = <Nft>await soonDb().doc(`${COL.NFT}/${placeholderNft.uid}`).get();
      expect(placeholderNft.status).toBe(NftStatus.PRE_MINTED);
    },
  );

  it('Should unlock locked nft', async () => {
    let lockedNft = await helper.createLockedNft();
    await helper.mintCollection();
    const lockedNftOrder = <Transaction>(
      await soonDb().doc(`${COL.TRANSACTION}/${lockedNft.lockedBy}`).get()
    );
    expect(lockedNftOrder.payload.void).toBe(true);

    lockedNft = <Nft>await soonDb().doc(`${COL.NFT}/${lockedNft.uid}`).get();
    expect(lockedNft.locked).toBe(false);
    expect(lockedNft.lockedBy).toBe(null);
    expect(lockedNft.mintingData).toBeDefined();
    expect(lockedNft.status).toBe(NftStatus.MINTED);
  });
});
