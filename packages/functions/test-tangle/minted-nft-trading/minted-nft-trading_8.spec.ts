import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  NftPurchaseTangleRequest,
  NftStatus,
  TangleRequestType,
  Transaction,
} from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Minted nft trading', () => {
  const helper = new Helper();
  let tangleOrder: Transaction;

  beforeAll(async () => {
    await helper.beforeAll();
    tangleOrder = await getTangleOrder();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should purchase nft with tangle request, no withdraw', async () => {
    const address = await helper.walletService!.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.RMS, address.bech32, 5 * MIN_IOTA_AMOUNT);

    await helper.createAndOrderNft();
    await helper.mintCollection();
    await helper.setAvailableForSale();

    await helper.walletService!.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.NFT_PURCHASE,
          collection: helper.collection,
          nft: helper.nft!.uid,
          disableWithdraw: true,
        } as NftPurchaseTangleRequest,
      },
    });
    await MnemonicService.store(address.bech32, address.mnemonic, Network.RMS);

    const nftDocRef = build5Db().doc(`${COL.NFT}/${helper.nft!.uid}`);
    await wait(async () => {
      const nft = await nftDocRef.get<Nft>();
      return nft?.owner === address.bech32 && nft.status === NftStatus.MINTED;
    });
  });
});
