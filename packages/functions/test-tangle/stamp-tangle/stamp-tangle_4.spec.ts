import { database } from '@buildcore/database';
import { COL, TransactionType } from '@buildcore/interfaces';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { wait } from '../../test/controls/common';
import { Helper } from './Helper';

describe('Stamp tangle test', () => {
  const helper = new Helper();

  beforeAll(helper.beforeAll);
  beforeEach(helper.beforeEach);

  it('Should credit, not enough token sent', async () => {
    const amountToMint = 53700 + 108000;
    await helper.wallet!.send(
      helper.address,
      helper.tangleOrder.payload.targetAddress!,
      amountToMint,
      { customMetadata: { request: helper.request } },
    );
    await MnemonicService.store(helper.address.bech32, helper.address.mnemonic);

    const query = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.address.bech32)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });
    const credit = (await query.get())[0];
    expect(credit.payload.response!.address).toBeDefined();
  });
});
