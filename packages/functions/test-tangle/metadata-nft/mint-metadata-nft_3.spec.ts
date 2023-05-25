import { INftOutput, IndexerPluginClient, TransactionHelper } from '@iota/iota.js-next';
import {
  COL,
  Collection,
  MIN_IOTA_AMOUNT,
  NftStatus,
  Space,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { getNftByMintingId } from '../../src/utils/collection-minting-utils/nft.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
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
    const credit = (await creditQuery.get<Transaction>())[0];

    const indexer = new IndexerPluginClient(helper.walletService.client);
    const nftResult = await indexer.nfts({ addressBech32: helper.memberAddress.bech32 });
    const nftOutput = (await helper.walletService.client.output(nftResult.items[0]))
      .output as INftOutput;

    const space = <Space>await soonDb().doc(`${COL.SPACE}/${credit.space}`).get();
    const collectionQuery = soonDb().collection(COL.COLLECTION).where('space', '==', space.uid);
    const collection = (await collectionQuery.get<Collection>())[0];

    const nftId = TransactionHelper.resolveIdFromOutputId(nftResult.items[0]);
    const nftTransfer = <Transaction>{
      type: TransactionType.WITHDRAW_NFT,
      uid: getRandomEthAddress(),
      member: helper.member,
      space: '',
      network: helper.network,
      payload: {
        amount: Number(nftOutput.amount),
        sourceAddress: helper.memberAddress.bech32,
        targetAddress: tangleOrder.payload.targetAddress,
        nftId,
      },
    };

    const nftWallet = new NftWallet(helper.walletService);
    await nftWallet.changeNftOwner(nftTransfer, {});

    await wait(async () => {
      const nft = await getNftByMintingId(nftId);
      return nft?.status === NftStatus.MINTED;
    });

    await helper.walletService.send(
      helper.memberAddress,
      tangleOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.MINT_METADATA_NFT,
            metadata: { asd: 'hello' },
            aliasId: space.alias?.aliasId,
            collectionId: collection.mintingData?.nftId,
            nftId,
          },
        },
      },
    );
    await MnemonicService.store(
      helper.memberAddress.bech32,
      helper.memberAddress.mnemonic,
      helper.network,
    );
  });
});
