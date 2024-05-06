import { database } from '@buildcore/database';
import { COL, MIN_IOTA_AMOUNT } from '@buildcore/interfaces';
import { isEmpty } from 'lodash';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { EMPTY_ALIAS_ID } from '../../src/utils/token-minting-utils/alias.utils';
import { wait } from '../../test/controls/common';
import { Helper } from './Helper';

describe('Stamp tangle test', () => {
  const helper = new Helper();

  beforeAll(helper.beforeAll);
  beforeEach(helper.beforeEach);

  it('Should create and mint 2 stamps', async () => {
    await helper.wallet!.send(
      helper.address,
      helper.tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      { customMetadata: { request: helper.request } },
    );
    await MnemonicService.store(helper.address.bech32, helper.address.mnemonic);

    let query = database().collection(COL.STAMP).where('createdBy', '==', helper.address.bech32);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1 && snap[0].aliasId !== EMPTY_ALIAS_ID;
    });
    const stamp = (await query.get())[0];

    await helper.wallet!.send(
      helper.address,
      helper.tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      { customMetadata: { request: { ...helper.request, aliasId: stamp.aliasId } } },
    );
    await MnemonicService.store(helper.address.bech32, helper.address.mnemonic);

    await wait(async () => {
      const snap = await query.get();
      return snap.length === 2 && snap[0].aliasId === snap[1].aliasId;
    });

    await wait(async () => {
      const snap = await query.get();
      return snap.reduce((acc, act) => acc && !isEmpty(act.nftId), true);
    });
    const stamps = await query.get();
    expect(stamps.length).toBe(2);
    expect(stamps[0].aliasId).toBe(stamps[1].aliasId);
    expect(stamps[0].nftId).not.toBe(stamps[1].nftId);
  });
});
