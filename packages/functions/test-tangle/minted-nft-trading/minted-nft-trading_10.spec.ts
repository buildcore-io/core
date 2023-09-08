import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  NftPurchaseTangleRequest,
  TangleRequestType,
  Transaction,
} from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { awaitLedgerInclusionState, requestFundsFromFaucet } from '../faucet';
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

  it('Should buy 2 nft in parallel', async () => {
    const address = await helper.walletService!.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.RMS, address.bech32, 5 * MIN_IOTA_AMOUNT);

    let nft1 = await helper.createAndOrderNft();
    let nft2 = await helper.createAndOrderNft();

    await helper.mintCollection();

    await helper.setAvailableForAuction(nft1.uid);
    await helper.setAvailableForAuction(nft2.uid);

    const blockId = await helper.walletService!.send(
      address,
      tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.NFT_PURCHASE,
            collection: helper.collection,
            nft: nft1.uid,
            disableWithdraw: true,
          } as NftPurchaseTangleRequest,
        },
      },
    );
    await MnemonicService.store(address.bech32, address.mnemonic, Network.RMS);

    await awaitLedgerInclusionState(blockId, tangleOrder.network);

    await helper.walletService!.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.NFT_PURCHASE,
          collection: helper.collection,
          nft: nft2.uid,
          disableWithdraw: true,
        } as NftPurchaseTangleRequest,
      },
    });
    await MnemonicService.store(address.bech32, address.mnemonic, Network.RMS);

    const nftDocRef1 = build5Db().doc(`${COL.NFT}/${nft1.uid}`);
    const nftDocRef2 = build5Db().doc(`${COL.NFT}/${nft2.uid}`);

    await wait(async () => {
      nft1 = (await nftDocRef1.get<Nft>())!;
      nft2 = (await nftDocRef2.get<Nft>())!;
      return nft1?.owner === address.bech32 && nft2?.owner === address.bech32;
    });
  });
});
