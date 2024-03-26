import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  NftPurchaseTangleRequest,
  NftStatus,
  TangleRequestType,
} from '@build-5/interfaces';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { wait } from '../../test/controls/common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Minted nft trading', () => {
  const helper = new Helper();

  it.each([Network.RMS, Network.ATOI])(
    'Should purchase nft with tangle request, no withdraw',
    async (network: Network) => {
      await helper.beforeEach(network);
      const address = await helper.walletService!.getNewIotaAddressDetails();
      await requestFundsFromFaucet(Network.RMS, address.bech32, 5 * MIN_IOTA_AMOUNT);

      await helper.createAndOrderNft();
      await helper.mintCollection();
      await helper.setAvailableForSale();

      await helper.walletService!.send(
        address,
        helper.tangleOrder.payload.targetAddress!,
        MIN_IOTA_AMOUNT,
        {
          customMetadata: {
            request: {
              requestType: TangleRequestType.NFT_PURCHASE,
              collection: helper.collection,
              nft: helper.nft!.uid,
              disableWithdraw: true,
            } as NftPurchaseTangleRequest,
          },
        },
      );
      await MnemonicService.store(address.bech32, address.mnemonic, Network.RMS);

      const nftDocRef = build5Db().doc(COL.NFT, helper.nft!.uid);
      await wait(async () => {
        const nft = await nftDocRef.get();
        return nft?.owner === address.bech32 && nft.status === NftStatus.MINTED;
      });
    },
  );
});
