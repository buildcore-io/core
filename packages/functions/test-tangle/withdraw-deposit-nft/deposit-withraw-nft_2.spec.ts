/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
import { COL, Transaction, TransactionType, WEN_FUNC } from '@buildcore/interfaces';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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

    mockWalletReturnValue(helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap<Transaction>(WEN_FUNC.depositNft);

    const promises = [
      helper.sendNftToAddress(tmpAddress1, depositOrder.payload.targetAddress!),
      helper.sendNftToAddress(tmpAddress2, depositOrder.payload.targetAddress!),
    ];
    await Promise.all(promises);

    await wait(async () => {
      const snap = await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT_NFT)
        .where('member', '==', helper.guardian)
        .get();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
  });
});
