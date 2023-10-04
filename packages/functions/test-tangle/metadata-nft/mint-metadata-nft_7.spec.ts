import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  TangleRequestType,
  Transaction,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { wait } from '../../test/controls/common';
import { Helper } from './Helper';

describe('Metadata nft', () => {
  const helper = new Helper();

  it.each([Network.RMS, Network.ATOI])(
    'Should throw invalid collection id',
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

      let creditQuery = build5Db()
        .collection(COL.TRANSACTION)
        .where('member', '==', helper.member)
        .where('type', '==', TransactionType.CREDIT);
      await wait(async () => {
        const snap = await creditQuery.get<Transaction>();
        return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
      });

      await helper.walletService.send(
        helper.memberAddress,
        helper.tangleOrder.payload.targetAddress!,
        MIN_IOTA_AMOUNT,
        {
          customMetadata: {
            request: {
              requestType: TangleRequestType.MINT_METADATA_NFT,
              metadata,
              collectionId: getRandomEthAddress(),
            },
          },
        },
      );
      creditQuery = build5Db()
        .collection(COL.TRANSACTION)
        .where('member', '==', helper.member)
        .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
      await wait(async () => {
        const snap = await creditQuery.get<Transaction>();
        return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
      });
      const snap = await creditQuery.get<Transaction>();
      expect((snap[0].payload.response as any).message).toBe(WenError.invalid_collection_id.key);
    },
  );
});
