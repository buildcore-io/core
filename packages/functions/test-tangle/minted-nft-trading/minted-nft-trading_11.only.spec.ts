import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  NftPurchaseTangleRequest,
  NftStatus,
  TangleRequestType,
  TransactionType,
} from '@buildcore/interfaces';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { wait } from '../../test/controls/common';
import { awaitLedgerInclusionState, requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Minted nft trading', () => {
  const helper = new Helper();

  it('Should buy 2 nft in parallel, and deposit in parallel', async () => {
    await helper.beforeEach(Network.RMS);
    const address = await helper.walletService!.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.RMS, address.bech32, 5 * MIN_IOTA_AMOUNT);

    let nft1 = await helper.createAndOrderNft();
    let nft2 = await helper.createAndOrderNft();

    await helper.mintCollection();

    await helper.setAvailableForAuction(nft1.uid);
    await helper.setAvailableForAuction(nft2.uid);

    const blockId = await helper.walletService!.send(
      address,
      helper.tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.NFT_PURCHASE,
            collection: helper.collection,
            nft: nft1.uid,
          } as NftPurchaseTangleRequest,
        },
      },
    );
    await MnemonicService.store(address.bech32, address.mnemonic, Network.RMS);

    await awaitLedgerInclusionState(blockId);

    await helper.walletService!.send(
      address,
      helper.tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.NFT_PURCHASE,
            collection: helper.collection,
            nft: nft2.uid,
          } as NftPurchaseTangleRequest,
        },
      },
    );
    await MnemonicService.store(address.bech32, address.mnemonic, Network.RMS);

    const nftDocRef1 = database().doc(COL.NFT, nft1.uid);
    const nftDocRef2 = database().doc(COL.NFT, nft2.uid);
    nft1 = (await nftDocRef1.get())!;
    nft2 = (await nftDocRef2.get())!;

    const query = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('member', '==', address.bech32);
    await wait(async () => {
      const snap = await query.get();
      return (
        snap.length === 2 &&
        snap[0]?.payload?.walletReference?.confirmed &&
        snap[1]?.payload?.walletReference?.confirmed
      );
    });

    await helper.sendNftToAddress(
      address,
      helper.tangleOrder.payload.targetAddress!,
      nft1.mintingData?.nftId!,
    );
    await helper.sendNftToAddress(
      address,
      helper.tangleOrder.payload.targetAddress!,
      nft2.mintingData?.nftId!,
    );

    await wait(async () => {
      nft1 = (await nftDocRef1.get())!;
      nft2 = (await nftDocRef2.get())!;
      return nft1?.status === NftStatus.MINTED && nft2?.status === NftStatus.MINTED;
    });
  });
});
