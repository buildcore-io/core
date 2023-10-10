import {
  COL,
  Collection,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import { BasicOutput, RegularTransactionEssence, TransactionPayload } from '@iota/sdk';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { getOutputMetadata } from '../../src/utils/basic-output.utils';
import { wait } from '../../test/controls/common';
import { Helper } from './Helper';

describe('Metadata nft', () => {
  const helper = new Helper();

  it.each([Network.RMS, Network.ATOI])(
    'Should mint metada nft, mint new one for same collection',
    async (network: Network) => {
      await helper.beforeEach(network);
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
      const credit = (await creditQuery.get<Transaction>())[0];

      const space = <Space>await build5Db().doc(`${COL.SPACE}/${credit.space}`).get();
      const collectionQuery = build5Db().collection(COL.COLLECTION).where('space', '==', space.uid);
      const collection = (await collectionQuery.get<Collection>())[0];

      await helper.walletService.send(
        helper.memberAddress,
        helper.tangleOrder.payload.targetAddress!,
        MIN_IOTA_AMOUNT,
        {
          customMetadata: {
            request: {
              requestType: TangleRequestType.MINT_METADATA_NFT,
              metadata,
              collectionId: collection.mintingData?.nftId,
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
      const credits = await creditQuery.get<Transaction>();
      const credit1Meta = await getMetadata(
        helper.walletService,
        credits[0].payload.walletReference!.chainReference!,
      );
      const credit2Meta = await getMetadata(
        helper.walletService,
        credits[1].payload.walletReference!.chainReference!,
      );
      expect(credit1Meta.aliasId).toBe(credit2Meta.aliasId);
      expect(credit1Meta.collectionId).toBe(credit2Meta.collectionId);
      expect(credit1Meta.nftId).not.toBe(credit2Meta.nftId);
    },
  );
});

const getMetadata = async (wallet: Wallet, blockId: string) => {
  const block = await wallet.client.getBlock(blockId);
  const payload = block.payload! as TransactionPayload;
  const output = (payload.essence as RegularTransactionEssence).outputs[0] as BasicOutput;
  return getOutputMetadata(output);
};
