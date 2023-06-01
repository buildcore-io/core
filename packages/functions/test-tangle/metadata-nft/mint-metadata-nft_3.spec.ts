import { INftOutput, IndexerPluginClient } from '@iota/iota.js-next';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Nft,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
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
      tangleOrder.payload.targetAddress,
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

    const mintMetadataNftQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.member)
      .where('type', '==', TransactionType.METADATA_NFT);
    await wait(async () => {
      const snap = await mintMetadataNftQuery.get();
      return snap.length === 3;
    });

    const creditQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.member)
      .where('type', '==', TransactionType.CREDIT);
    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });

    const nftQuery = soonDb().collection(COL.NFT).where('owner', '==', helper.member);
    const nft = (await nftQuery.get<Nft>())[0];

    await helper.walletService.send(
      helper.memberAddress,
      tangleOrder.payload.targetAddress,
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
        snap.reduce((acc, act) => acc && act.payload?.walletReference?.confirmed, true)
      );
    });

    const indexer = new IndexerPluginClient(helper.walletService.client);

    const nftOutputId = (await indexer.nft(nft.mintingData?.nftId!)).items[0];
    const nftOutput = (await helper.walletService.client.output(nftOutputId)).output as INftOutput;
    const meta = getOutputMetadata(nftOutput);
    expect(meta).toEqual({ asd: 'hello' });
  });
});
