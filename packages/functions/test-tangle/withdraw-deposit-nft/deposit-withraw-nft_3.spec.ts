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

  it('Should credit invalid nft', async () => {
    const nft = await helper.createAndOrderNft();
    await helper.mintCollection();

    const tmpAddress1 = await helper.walletService!.getNewIotaAddressDetails();
    await helper.updateGuardianAddress(tmpAddress1.bech32);
    await helper.withdrawNftAndAwait(nft.uid);

    await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).delete();

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap(depositNft)({});

    await helper.sendNftToAddress(tmpAddress1, depositOrder.payload.targetAddress);

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
