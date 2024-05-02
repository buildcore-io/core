import { build5Db } from '@build-5/database';
import {
  COL,
  Network,
  Transaction,
  TransactionPayloadType,
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

  it('Mint NFT with https request, then update it', async () => {
    const network = Network.RMS;
    await h.beforeEach(network);

    const metadata = { mytest: 'mytest', sayhi: 'asdasdasd' };

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

    const addressQuery = build5Db()
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

    mockWalletReturnValue(h.member, {
      network,
      metadata: { sayhi: 'hello' },
      nftId: nft.mintingData?.nftId,
    });
    const updateOrder = await testEnv.wrap<Transaction>(WEN_FUNC.mintMetadataNft);
    await requestFundsFromFaucet(
      network,
      updateOrder.payload.targetAddress!,
      updateOrder.payload.amount!,
    );

    const typesQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.member)
      .where('type', '==', TransactionType.METADATA_NFT)
      .where('payload_type', '==', TransactionPayloadType.UPDATE_MINTED_NFT);
    await wait(async () => {
      const snap = await typesQuery.get();
      return snap.length === 1 && snap[0].payload?.walletReference?.confirmed;
    });

    nftOutputId = await client.nftOutputId(nft.mintingData!.nftId!);
    nftOutput = (await client.getOutput(nftOutputId)).output as NftOutput;
    outputMetadata = getOutputMetadata(nftOutput);
    expect(outputMetadata).toEqual({ sayhi: 'hello' });
  });
});
