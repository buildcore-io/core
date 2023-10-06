import {
  COL,
  Collection,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  Space,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import { BasicOutput, RegularTransactionEssence, TransactionPayload } from '@iota/sdk';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { getOutputMetadata } from '../../src/utils/basic-output.utils';
import { wait } from '../../test/controls/common';
import { Helper } from './Helper';

describe('Metadata nft', () => {
  const helper = new Helper();

  it('Should mint metada nft', async () => {
    await helper.beforeEach(Network.RMS);
    const metadata = { mytest: 'mytest', asd: 'asdasdasd' };
    const blockId = await helper.walletService.send(
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
    const credit = (await creditQuery.get<Transaction>())[0];
    const block = await helper.walletService.client.getBlock(
      credit.payload.walletReference!.chainReference!,
    );
    const payload = block.payload! as TransactionPayload;
    const output = (payload.essence as RegularTransactionEssence).outputs[0] as BasicOutput;
    const outputMetadata = getOutputMetadata(output);

    const nftQuery = build5Db().collection(COL.NFT).where('owner', '==', helper.member);
    const nft = (await nftQuery.get<Nft>())[0];
    const collection = await build5Db()
      .doc(`${COL.COLLECTION}/${nft.collection}`)
      .get<Collection>();
    const space = await build5Db().doc(`${COL.SPACE}/${nft.space}`).get<Space>();
    expect(outputMetadata).toEqual({
      nftId: nft!.mintingData!.nftId,
      collectionId: collection!.mintingData!.nftId,
      aliasId: space!.alias!.aliasId,
    });

    const items = (await helper.walletService.client.basicOutputIds([{ tag: blockId }])).items;
    expect(items.length).toBe(1);
  });
});
