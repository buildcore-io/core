import {
  COL,
  CollectionType,
  MIN_IOTA_AMOUNT,
  Network,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { wait } from '../../test/controls/common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Minted nft trading', () => {
  const helper = new Helper();

  it.each([Network.RMS, Network.ATOI])(
    'Should purchase random nft with tangle request',
    async (network: Network) => {
      await helper.beforeEach(network, CollectionType.GENERATED);
      const address = await helper.walletService!.getNewIotaAddressDetails();
      await requestFundsFromFaucet(Network.RMS, address.bech32, 5 * MIN_IOTA_AMOUNT);

      await helper.createAndOrderNft(false);
      await helper.mintCollection();

      await helper.walletService!.send(
        address,
        helper.tangleOrder.payload.targetAddress!,
        MIN_IOTA_AMOUNT,
        {
          customMetadata: {
            request: {
              requestType: TangleRequestType.NFT_PURCHASE,
              collection: helper.collection,
            },
          },
        },
      );
      await MnemonicService.store(address.bech32, address.mnemonic, Network.RMS);

      await wait(async () => {
        const snap = await build5Db()
          .collection(COL.TRANSACTION)
          .where('member', '==', address.bech32)
          .where('type', '==', TransactionType.WITHDRAW_NFT)
          .get<Transaction>();
        return snap.length > 0 && snap[0]?.payload?.walletReference?.confirmed;
      });
      const nftOutputIds = await helper.walletService!.client.nftOutputIds([
        { address: address.bech32 },
      ]);
      expect(nftOutputIds.items.length).toBe(1);
    },
  );
});
