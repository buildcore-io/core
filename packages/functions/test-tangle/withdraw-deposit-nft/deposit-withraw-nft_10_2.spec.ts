/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Transaction, TransactionType } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { depositNft } from '../../src/runtime/firebase/nft';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper } from './Helper';

const HUGE_CID = 'bafybeiae5ai264zyte7qtnrelp5aplwkgb22yurwnwcqlugwwkxwlyoh4i';

describe('Collection minting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should credit, ipfs max size', async () => {
    await helper.mintWithCustomNftCID(() => HUGE_CID);

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap(depositNft)({});
    await helper.sendNftToAddress(helper.guardianAddress!, depositOrder.payload.targetAddress);

    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.guardian)
      .where('type', '==', TransactionType.CREDIT_NFT);
    await wait(async () => {
      const snap = await query.get();
      return snap.size === 1;
    });
    const snap = await query.get();
    const credit = <Transaction>snap.docs[0].data();
    expect(credit.payload.response.code).toBe(2118);
    expect(credit.payload.response.message).toBe('Maximum media size is 100 MB');
    await helper.isInvalidPayment(credit.payload.sourceTransaction[0]);
  });
});