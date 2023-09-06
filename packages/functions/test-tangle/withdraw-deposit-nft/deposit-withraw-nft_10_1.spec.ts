/* eslint-disable @typescript-eslint/no-explicit-any */
import { build5Db } from '@build-5/database';
import { COL, Transaction, TransactionType } from '@build-5/interfaces';
import { depositNft } from '../../src/runtime/firebase/nft';
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

  it('Should credit, ipfs invalid', async () => {
    await helper.mintWithCustomNftCID((ipfsMedia) =>
      Array.from(Array(ipfsMedia.length))
        .map(() => 'a')
        .join(''),
    );

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap(depositNft)({});
    await helper.sendNftToAddress(helper.guardianAddress!, depositOrder.payload.targetAddress);

    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.guardian)
      .where('type', '==', TransactionType.CREDIT_NFT);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });
    const snap = await query.get();
    const credit = <Transaction>snap[0];
    expect(credit.payload.response!.code).toBe(2117);
    expect(credit.payload.response!.message).toBe('Could not get data from ipfs');
    await helper.isInvalidPayment(credit.payload.sourceTransaction![0]);
  });
});
