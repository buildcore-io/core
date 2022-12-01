/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, TransactionType } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { depositNft } from '../../src/controls/nft/nft.control';
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
      const snap = await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT_NFT)
        .where('member', '==', helper.guardian)
        .get();
      return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
    });
  });
});
