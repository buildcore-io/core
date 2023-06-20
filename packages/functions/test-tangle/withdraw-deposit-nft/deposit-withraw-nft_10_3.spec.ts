/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Transaction, TransactionType } from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
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

  it('Should credit, ipfs does not point to img or video', async () => {
    await helper.mintWithCustomNftCID(
      () => 'bafybeidzgwp4grz4a3bze26xaouzts4jkkovz6idpu456n3dy36gpe6qem',
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
    expect(credit.payload.response!.code).toBe(2125);
    expect(credit.payload.response!.message).toBe('Url does not point to an image or video');
    await helper.isInvalidPayment(credit.payload.sourceTransaction![0]);
  });
});
