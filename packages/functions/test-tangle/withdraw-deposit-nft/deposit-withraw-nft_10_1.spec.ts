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

  it('Should credit, ipfs invalid', async () => {
    await helper.mintWithCustomNftCID((ipfsMedia) =>
      Array.from(Array(ipfsMedia.length))
        .map(() => 'a')
        .join(''),
    );

    mockWalletReturnValue(helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap<Transaction>(WEN_FUNC.depositNft);
    await helper.sendNftToAddress(helper.guardianAddress!, depositOrder.payload.targetAddress!);

    const query = database()
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
