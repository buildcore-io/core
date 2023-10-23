import { build5Db } from '@build-5/database';
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
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { wait } from '../../test/controls/common';
import { Helper } from './Helper';

describe('Metadata nft', () => {
  const helper = new Helper();

  it.each([Network.RMS, Network.ATOI])(
    'Should mint metada nft, mint new one for same alias but new collection',
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

      await helper.walletService.send(
        helper.memberAddress,
        helper.tangleOrder.payload.targetAddress!,
        MIN_IOTA_AMOUNT,
        {
          customMetadata: {
            request: {
              requestType: TangleRequestType.MINT_METADATA_NFT,
              metadata,
              aliasId: space.alias?.aliasId,
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

      const nfts = await build5Db()
        .collection(COL.NFT)
        .where('owner', '==', helper.member)
        .get<Nft>();
      expect(nfts[0].collection).not.toBe(nfts[1].collection);
      expect(nfts[0].space).toBe(nfts[1].space);

      const collections = await build5Db()
        .collection(COL.COLLECTION)
        .where('space', '==', space.uid)
        .get<Collection>();
      expect(collections.length).toBe(2);
    },
  );
});
