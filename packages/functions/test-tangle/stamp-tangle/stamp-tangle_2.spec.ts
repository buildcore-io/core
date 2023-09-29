import { build5Db } from '@build-5/database';
import { COL, MIN_IOTA_AMOUNT, Stamp, Transaction, TransactionType } from '@build-5/interfaces';
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

    let creditResponse = await helper.getCreditResponse();
    let thirtyDayCost =
      (creditResponse.dailyCost as number) * 30 + (creditResponse.amountToMint as number);
    await helper.wallet!.send(helper.address, creditResponse.address as string, thirtyDayCost, {});
    await MnemonicService.store(helper.address.bech32, helper.address.mnemonic);

    const stampDocRef = build5Db().doc(`${COL.STAMP}/${creditResponse.stamp}`);
    await wait(async () => {
      const stamp = await stampDocRef.get<Stamp>();
      return stamp?.aliasId !== EMPTY_ALIAS_ID;
    });
    const stamp = await stampDocRef.get<Stamp>();

    await helper.wallet!.send(
      helper.address,
      helper.tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      { customMetadata: { request: { ...helper.request, aliasId: stamp?.aliasId } } },
    );
    await MnemonicService.store(helper.address.bech32, helper.address.mnemonic);

    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.address.bech32)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
      .orderBy('createdOn');
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return (
        snap.length === 2 &&
        snap[0].payload.walletReference?.confirmed === true &&
        snap[1].payload.walletReference?.confirmed === true
      );
    });

    creditResponse = (await query.get<Transaction>())[1].payload.response!;
    thirtyDayCost =
      (creditResponse.dailyCost as number) * 30 + (creditResponse.amountToMint as number);
    await helper.wallet!.send(helper.address, creditResponse.address as string, thirtyDayCost, {});
    await MnemonicService.store(helper.address.bech32, helper.address.mnemonic);

    const stampQuery = build5Db()
      .collection(COL.STAMP)
      .where('createdBy', '==', helper.address.bech32);
    await wait(async () => {
      const snap = await stampQuery.get<Stamp>();
      return snap.reduce((acc, act) => acc && !isEmpty(act.nftId), true);
    });
    const stamps = await stampQuery.get<Stamp>();
    expect(stamps.length).toBe(2);
    expect(stamps[0].aliasId).toBe(stamps[1].aliasId);
    expect(stamps[0].nftId).not.toBe(stamps[1].nftId);
  });
});
