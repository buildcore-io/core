import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import { NftOutput } from '@iota/sdk';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { getOutputMetadata } from '../../src/utils/basic-output.utils';
import { wait } from '../../test/controls/common';
import { Helper } from './Helper';

describe('Metadata nft', () => {
  const helper = new Helper();

  it('Should mint metada nft then update metadata', async () => {
    await helper.beforeEach(Network.ATOI);
    const metadata = { mytest: 'mytest', asd: 'asdasdasd' };
    await helper.walletService.send(
      helper.memberAddress,
      helper.tangleOrder.payload.targetAddress!,
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
      helper.tangleOrder.payload.targetAddress!,
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

    let nftOutputId = await helper.walletService.client.nftOutputId(nft.mintingData?.nftId!);
    let nftOutput = (await helper.walletService.client.getOutput(nftOutputId)).output as NftOutput;
    let meta = getOutputMetadata(nftOutput);
    expect(meta).toEqual({ asd: 'hello' });

    await helper.walletService.send(
      helper.memberAddress,
      helper.tangleOrder.payload.targetAddress!,
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

    nftOutputId = await helper.walletService.client.nftOutputId(nft.mintingData?.nftId!);
    nftOutput = (await helper.walletService.client.getOutput(nftOutputId)).output as NftOutput;
    meta = getOutputMetadata(nftOutput);
    expect(meta).toEqual({ asd: 'helloasdasd2' });
  });
});
