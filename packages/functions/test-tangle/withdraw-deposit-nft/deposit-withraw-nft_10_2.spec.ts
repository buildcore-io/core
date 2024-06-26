/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
import { COL, Transaction, TransactionType, WEN_FUNC } from '@buildcore/interfaces';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { Helper } from './Helper';

const HUGE_CID = 'bafybeidxlcm7vs3uh3afk6tzye3rdzjjgaqrmj6fzaz3jf23e66f35dkce';

describe('Collection minting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  // TODO skip until the file gets to IPFS
  it.skip('Should credit, ipfs max size', async () => {
    await helper.mintWithCustomNftCID(() => HUGE_CID);

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
    expect(credit.payload.response!.code).toBe(2118);
    expect(credit.payload.response!.message).toBe('Maximum media size is 100 MB');
    await helper.isInvalidPayment(credit.payload.sourceTransaction![0]);
  });
});
