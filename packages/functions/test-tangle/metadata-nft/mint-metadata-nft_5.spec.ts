import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  TangleRequestType,
  TransactionType,
} from '@buildcore/interfaces';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { wait } from '../../test/controls/common';
import { Helper } from './Helper';

describe('Metadata nft', () => {
  const helper = new Helper();

  it('Should mint metada nft, mint two new one for same collection&alias, in parallel', async () => {
    await helper.beforeEach(Network.RMS);

    const metadata = { mytest: 'mytest', name: 'asdasdasd' };
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

    const space = <Space>await database().doc(COL.SPACE, credit.space!).get();
    const collection = (
      await database().collection(COL.COLLECTION).where('space', '==', space.uid).get()
    )[0];

    await helper.walletService.sendToMany(
      helper.memberAddress,
      [
        {
          toAddress: helper.tangleOrder.payload.targetAddress!,
          amount: MIN_IOTA_AMOUNT,
          customMetadata: {
            request: {
              requestType: TangleRequestType.MINT_METADATA_NFT,
              metadata,
              aliasId: space.alias?.aliasId,
              collectionId: collection.mintingData?.nftId,
            },
          },
        },
        {
          toAddress: helper.tangleOrder.payload.targetAddress!,
          amount: MIN_IOTA_AMOUNT,
          customMetadata: {
            request: {
              requestType: TangleRequestType.MINT_METADATA_NFT,
              metadata,
              aliasId: space.alias?.aliasId,
              collectionId: collection.mintingData?.nftId,
            },
          },
        },
      ],
      {},
    );
    await MnemonicService.store(
      helper.memberAddress.bech32,
      helper.memberAddress.mnemonic,
      helper.network,
    );

    await wait(async () => {
      const snap = await creditQuery.get();
      return (
        snap.length === 3 &&
        snap.reduce((acc, act) => acc && (act.payload?.walletReference?.confirmed || false), true)
      );
    });
  });
});
