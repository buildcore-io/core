import { build5Db } from '@build-5/database';
import { COL, MIN_IOTA_AMOUNT, TransactionPayloadType } from '@build-5/interfaces';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { wait } from '../../test/controls/common';
import { Helper } from './Helper';

describe('Stamp tangle test', () => {
  const helper = new Helper();

  beforeAll(helper.beforeAll);
  beforeEach(helper.beforeEach);

  it('Should credit, not enough token sent', async () => {
    await helper.wallet!.send(
      helper.address,
      helper.tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      { customMetadata: { request: helper.request } },
    );
    await MnemonicService.store(helper.address.bech32, helper.address.mnemonic);

    const creditResponse = await helper.getCreditResponse();
    await helper.wallet!.send(
      helper.address,
      creditResponse.address as string,
      creditResponse.amountToMint as number,
      {},
    );
    await MnemonicService.store(helper.address.bech32, helper.address.mnemonic);

    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.address.bech32)
      .where('payload.type', '==', TransactionPayloadType.INVALID_AMOUNT);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });
  });
});
