/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Transaction, TransactionType } from '@build-5/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { depositNft } from '../../src/runtime/firebase/nft/index';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Collection minting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should credit second nft sent to the same address', async () => {
    const nft1 = await helper.createAndOrderNft();
    const nft2 = await helper.createAndOrderNft();
    await helper.mintCollection();

    const tmpAddress1 = await helper.walletService!.getNewIotaAddressDetails();
    await helper.updateGuardianAddress(tmpAddress1.bech32);
    await helper.withdrawNftAndAwait(nft1.uid);

    const tmpAddress2 = await helper.walletService!.getNewIotaAddressDetails();
    await helper.updateGuardianAddress(tmpAddress2.bech32);
    await helper.withdrawNftAndAwait(nft2.uid);

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap(depositNft)({});

    const promises = [
      helper.sendNftToAddress(tmpAddress1, depositOrder.payload.targetAddress),
      helper.sendNftToAddress(tmpAddress2, depositOrder.payload.targetAddress),
    ];
    await Promise.all(promises);

    await wait(async () => {
      const snap = await soonDb()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT_NFT)
        .where('member', '==', helper.guardian)
        .get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
  });
});
