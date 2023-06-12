import {
  COL,
  Collection,
  MIN_IOTA_AMOUNT,
  Nft,
  Space,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@build5/interfaces';
import { IBasicOutput, ITransactionPayload, IndexerPluginClient } from '@iota/iota.js-next';
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

  it('Should mint metada nft', async () => {
    const metadata = { mytest: 'mytest', asd: 'asdasdasd' };
    const blockId = await helper.walletService.send(
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
    const block = await helper.walletService.client.block(
      credit.payload.walletReference.chainReference,
    );
    const payload = block.payload! as ITransactionPayload;
    const output = payload.essence.outputs[0] as IBasicOutput;
    const outputMetadata = getOutputMetadata(output);

    const nftQuery = soonDb().collection(COL.NFT).where('owner', '==', helper.member);
    const nft = (await nftQuery.get<Nft>())[0];
    const collection = await soonDb().doc(`${COL.COLLECTION}/${nft.collection}`).get<Collection>();
    const space = await soonDb().doc(`${COL.SPACE}/${nft.space}`).get<Space>();
    expect(outputMetadata).toEqual({
      nftId: nft!.mintingData!.nftId,
      collectionId: collection!.mintingData!.nftId,
      aliasId: space!.alias!.aliasId,
    });

    const indexer = new IndexerPluginClient(helper.walletService.client);
    const items = (await indexer.basicOutputs({ tagHex: blockId })).items;
    expect(items.length).toBe(1);
  });
});
