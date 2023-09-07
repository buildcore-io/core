import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  NftPurchaseTangleRequest,
  NftStatus,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
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

  it('Should purchase 2 nft with tangle request and deposit them back', async () => {
    const address = await helper.walletService!.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.RMS, address.bech32, 5 * MIN_IOTA_AMOUNT);

    let nft1 = await helper.createAndOrderNft();
    let nft2 = await helper.createAndOrderNft();
    await helper.mintCollection();
    await helper.setAvailableForSale(nft1.uid);
    await helper.setAvailableForSale(nft2.uid);

    await helper.walletService!.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.NFT_PURCHASE,
          collection: helper.collection,
          nft: nft1.uid,
        } as NftPurchaseTangleRequest,
      },
    });
    await MnemonicService.store(address.bech32, address.mnemonic, Network.RMS);

    let query = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload.nft', '==', nft1.uid);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });

    await helper.walletService!.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.NFT_PURCHASE,
          collection: helper.collection,
          nft: nft2.uid,
        } as NftPurchaseTangleRequest,
      },
    });
    await MnemonicService.store(address.bech32, address.mnemonic, Network.RMS);

    query = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload.nft', '==', nft2.uid);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });

    const nftDocRef1 = build5Db().doc(`${COL.NFT}/${nft1.uid}`);
    nft1 = (await nftDocRef1.get<Nft>())!;
    helper.sendNftToAddress(address, tangleOrder.payload.targetAddress!, nft1.mintingData?.nftId!);
    await wait(async () => {
      nft1 = (await nftDocRef1.get<Nft>())!;
      return nft1.status === NftStatus.MINTED;
    });

    const nftDocRef2 = build5Db().doc(`${COL.NFT}/${nft2.uid}`);
    nft2 = (await nftDocRef2.get<Nft>())!;
    helper.sendNftToAddress(address, tangleOrder.payload.targetAddress!, nft2.mintingData?.nftId!);
    await wait(async () => {
      nft2 = (await nftDocRef2.get<Nft>())!;
      return nft2.status === NftStatus.MINTED;
    });
  });
});
