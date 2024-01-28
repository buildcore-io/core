import { build5Db } from '@build-5/database';
import {
  COL,
  Network,
  Nft,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import { NftOutput } from '@iota/sdk';
import { mintMetadataNft } from '../../src/runtime/firebase/nft';
import { getOutputMetadata } from '../../src/utils/basic-output.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Metadata nft', () => {
  const h = new Helper();

  it('Mint NFT with https request, then update it', async () => {
    const network = Network.RMS;
    await h.beforeEach(network);

    const metadata = { mytest: 'mytest', asd: 'asdasdasd' };

    mockWalletReturnValue(h.walletSpy, h.member, { network, metadata });
    const order: Transaction = await testEnv.wrap(mintMetadataNft)({});

    await requestFundsFromFaucet(network, order.payload.targetAddress!, order.payload.amount!);

    let query = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.member)
      .where('type', '==', TransactionType.METADATA_NFT);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return (
        snap.length === 3 &&
        snap.reduce((acc, act) => (acc && act.payload?.walletReference?.confirmed) || false, true)
      );
    });

    query = build5Db()
      .collection(COL.NFT)
      .where('mintingData.address', '==', order.payload.targetAddress);
    await wait(async () => {
      const nfts = await query.get<Nft>();
      return nfts.length === 1;
    });

    const nft = (await query.get<Nft>())[0];
    const client = h.walletService.client;
    let nftOutputId = await client.nftOutputId(nft.mintingData!.nftId!);
    let nftOutput = (await client.getOutput(nftOutputId)).output as NftOutput;
    let outputMetadata = getOutputMetadata(nftOutput);
    expect(outputMetadata).toEqual(metadata);

    mockWalletReturnValue(h.walletSpy, h.member, {
      network,
      metadata: { asd: 'hello' },
      nftId: nft.mintingData?.nftId,
    });
    const updateOrder: Transaction = await testEnv.wrap(mintMetadataNft)({});
    await requestFundsFromFaucet(
      network,
      updateOrder.payload.targetAddress!,
      updateOrder.payload.amount!,
    );

    query = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', h.member)
      .where('type', '==', TransactionType.METADATA_NFT)
      .where('payload.type', '==', TransactionPayloadType.UPDATE_MINTED_NFT);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return snap.length === 1 && snap[0].payload?.walletReference?.confirmed;
    });

    nftOutputId = await client.nftOutputId(nft.mintingData!.nftId!);
    nftOutput = (await client.getOutput(nftOutputId)).output as NftOutput;
    outputMetadata = getOutputMetadata(nftOutput);
    expect(outputMetadata).toEqual({ asd: 'hello' });
  });
});
