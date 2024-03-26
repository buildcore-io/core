import { build5Db } from '@build-5/database';
import {
  COL,
  Collection,
  Network,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@build-5/interfaces';
import { NftOutput } from '@iota/sdk';
import { getOutputMetadata } from '../../src/utils/basic-output.utils';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Metadata nft', () => {
  const h = new Helper();

  it('Mint NFT with https request, 2 in same collection', async () => {
    const network = Network.RMS;
    await h.beforeEach(network);

    const metadata = { mytest: 'mytest', name: 'asdasdasd' };

    mockWalletReturnValue(h.member, { network, metadata });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.mintMetadataNft);

    await requestFundsFromFaucet(network, order.payload.targetAddress!, order.payload.amount!);

    const typeQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.member)
      .where('type', '==', TransactionType.METADATA_NFT);
    await wait(async () => {
      const snap = await typeQuery.get();
      return (
        snap.length === 3 &&
        snap.reduce((acc, act) => (acc && act.payload?.walletReference?.confirmed) || false, true)
      );
    });

    let addressQuery = build5Db()
      .collection(COL.NFT)
      .where('mintingData_address', '==', order.payload.targetAddress);
    await wait(async () => {
      const nfts = await addressQuery.get();
      return nfts.length === 1;
    });

    const nft = (await addressQuery.get())[0];
    const client = h.walletService.client;
    let nftOutputId = await client.nftOutputId(nft.mintingData!.nftId!);
    let nftOutput = (await client.getOutput(nftOutputId)).output as NftOutput;
    let outputMetadata = getOutputMetadata(nftOutput);
    expect(outputMetadata).toEqual(metadata);

    const collectionDocRef = build5Db().doc(COL.COLLECTION, nft.collection);
    const collection = <Collection>await collectionDocRef.get();

    mockWalletReturnValue(h.member, {
      network,
      metadata: { name: 'SecondNft' },
      collectionId: collection.mintingData?.nftId!,
    });
    const secondOrder = await testEnv.wrap<Transaction>(WEN_FUNC.mintMetadataNft);
    await requestFundsFromFaucet(
      network,
      secondOrder.payload.targetAddress!,
      secondOrder.payload.amount!,
    );

    addressQuery = build5Db()
      .collection(COL.NFT)
      .where('mintingData_address', '==', secondOrder.payload.targetAddress);
    await wait(async () => {
      const nfts = await addressQuery.get();
      return nfts.length === 1;
    });
    const secondNft = (await addressQuery.get())[0];

    expect(nft.collection).toBe(secondNft.collection);
  });
});
