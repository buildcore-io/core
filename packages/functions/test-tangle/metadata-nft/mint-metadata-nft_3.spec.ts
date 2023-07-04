import {
  COL,
  MIN_IOTA_AMOUNT,
  Nft,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import { INftOutput, IndexerPluginClient } from '@iota/iota.js-next';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { getOutputMetadata } from '../../src/utils/basic-output.utils';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { Helper } from './Helper';

describe('Metadata nft', () => {
  const helper = new Helper();
  let tangleOrder: Transaction;

  beforeAll(async () => {
    await helper.berforeAll();
    tangleOrder = await getTangleOrder();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should mint metada nft then update metadata', async () => {
    const metadata = { mytest: 'mytest', asd: 'asdasdasd' };
    await helper.walletService.send(
      helper.memberAddress,
      tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.MINT_METADATA_NFT,
            metadata,
          },
        },
      },
    );
    await MnemonicService.store(
      helper.memberAddress.bech32,
      helper.memberAddress.mnemonic,
      helper.network,
    );

    const mintMetadataNftQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.member)
      .where('type', '==', TransactionType.METADATA_NFT);
    await wait(async () => {
      const snap = await mintMetadataNftQuery.get();
      return snap.length === 3;
    });

    const creditQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.member)
      .where('type', '==', TransactionType.CREDIT);
    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });

    const nftQuery = build5Db().collection(COL.NFT).where('owner', '==', helper.member);
    const nft = (await nftQuery.get<Nft>())[0];

    await helper.walletService.send(
      helper.memberAddress,
      tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.MINT_METADATA_NFT,
            metadata: { asd: 'hello' },
            nftId: nft.mintingData?.nftId,
          },
        },
      },
    );
    await MnemonicService.store(
      helper.memberAddress.bech32,
      helper.memberAddress.mnemonic,
      helper.network,
    );

    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return (
        snap.length === 2 &&
        snap.reduce((acc, act) => acc && (act.payload?.walletReference?.confirmed || false), true)
      );
    });

    const indexer = new IndexerPluginClient(helper.walletService.client);

    let nftOutputId = (await indexer.nft(nft.mintingData?.nftId!)).items[0];
    let nftOutput = (await helper.walletService.client.output(nftOutputId)).output as INftOutput;
    let meta = getOutputMetadata(nftOutput);
    expect(meta).toEqual({ asd: 'hello' });

    await helper.walletService.send(
      helper.memberAddress,
      tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.MINT_METADATA_NFT,
            metadata: { asd: 'helloasdasd2' },
            nftId: nft.mintingData?.nftId,
          },
        },
      },
    );
    await MnemonicService.store(
      helper.memberAddress.bech32,
      helper.memberAddress.mnemonic,
      helper.network,
    );

    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return (
        snap.length === 3 &&
        snap.reduce((acc, act) => acc && (act.payload?.walletReference?.confirmed || false), true)
      );
    });

    nftOutputId = (await indexer.nft(nft.mintingData?.nftId!)).items[0];
    nftOutput = (await helper.walletService.client.output(nftOutputId)).output as INftOutput;
    meta = getOutputMetadata(nftOutput);
    expect(meta).toEqual({ asd: 'helloasdasd2' });
  });
});
