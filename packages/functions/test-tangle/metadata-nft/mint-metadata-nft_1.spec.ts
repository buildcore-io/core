import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  TangleRequestType,
  TransactionType,
} from '@buildcore/interfaces';
import { BasicOutput, RegularTransactionEssence, TransactionPayload } from '@iota/sdk';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { getOutputMetadata } from '../../src/utils/basic-output.utils';
import { wait } from '../../test/controls/common';
import { Helper } from './Helper';

describe('Metadata nft', () => {
  const helper = new Helper();

  it('Should mint metada nft', async () => {
    await helper.beforeEach(Network.RMS);
    const metadata = { mytest: 'mytest', name: 'asdasdasd' };
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

    const mintMetadataNftQuery = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.member)
      .where('type', '==', TransactionType.METADATA_NFT);
    await wait(async () => {
      const snap = await mintMetadataNftQuery.get();
      return snap.length === 3;
    });

    const creditQuery = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.member)
      .where('type', '==', TransactionType.CREDIT);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
    const credit = (await creditQuery.get())[0];
    const block = await helper.walletService.client.getBlock(
      credit.payload.walletReference!.chainReference!,
    );
    const payload = block.payload! as TransactionPayload;
    const output = (payload.essence as RegularTransactionEssence).outputs[0] as BasicOutput;
    const outputMetadata = getOutputMetadata(output);

    const nftQuery = database().collection(COL.NFT).where('owner', '==', helper.member);
    const nft = (await nftQuery.get())[0];
    const collection = await database().doc(COL.COLLECTION, nft.collection).get();
    const space = await database().doc(COL.SPACE, nft.space).get();
    expect(outputMetadata).toEqual({
      nftId: nft!.mintingData!.nftId,
      collectionId: collection!.mintingData!.nftId,
      aliasId: space!.alias!.aliasId,
    });

    const items = (await helper.walletService.client.basicOutputIds([{ tag: blockId }])).items;
    expect(items.length).toBe(1);
  });
});
