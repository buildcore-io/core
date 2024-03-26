import { build5Db } from '@build-5/database';
import {
  COL,
  Stamp,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { updateExpiredStamp } from '../../src/cron/stamp.cron';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { wait } from '../../test/controls/common';
import { Helper } from './Helper';

describe('Stamp tangle test', () => {
  const helper = new Helper();

  beforeAll(helper.beforeAll);
  beforeEach(helper.beforeEach);

  it('Should extend stamp', async () => {
    const now = dayjs();
    const fiftyDayCost = 2124 * 50 + 53700 + 104500;
    await helper.wallet!.send(
      helper.address,
      helper.tangleOrder.payload.targetAddress!,
      fiftyDayCost,
      { customMetadata: { request: helper.request } },
    );
    await MnemonicService.store(helper.address.bech32, helper.address.mnemonic);

    const query = build5Db().collection(COL.STAMP).where('createdBy', '==', helper.address.bech32);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1 && snap[0].nftId !== undefined;
    });
    let stamp = (await query.get())[0];

    const expiresAfter50Days = dayjs(stamp?.expiresAt.toDate()).isAfter(dayjs().add(4.32e9));
    expect(expiresAfter50Days).toBe(true);

    const orderDocRef = build5Db().doc(COL.TRANSACTION, stamp.order);
    const order = <Transaction>await orderDocRef.get();
    await helper.wallet!.send(helper.address, order.payload.targetAddress!, fiftyDayCost, {});
    await MnemonicService.store(helper.address.bech32, helper.address.mnemonic);

    await wait(async () => {
      const stamp = (await query.get())[0];
      const expiresAfter100Days = dayjs(stamp?.expiresAt.toDate()).isAfter(now.add(2 * 4.32e9));
      return expiresAfter100Days;
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const snap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.address.bech32)
      .where('type', '==', TransactionType.STAMP)
      .get();
    expect(snap.length).toBe(2);

    const stampDocRef = build5Db().doc(COL.STAMP, stamp.uid);
    await stampDocRef.update({ expiresAt: dayjs().subtract(1, 'h').toDate() });
    await updateExpiredStamp();
    stamp = <Stamp>await stampDocRef.get();
    expect(stamp?.expired).toBe(true);

    await helper.wallet!.send(helper.address, order.payload.targetAddress!, fiftyDayCost, {});
    await MnemonicService.store(helper.address.bech32, helper.address.mnemonic);

    await wait(async () => {
      const creditSnap = await build5Db()
        .collection(COL.TRANSACTION)
        .where('member', '==', helper.address.bech32)
        .where('type', '==', TransactionType.CREDIT)
        .where('payload_type', '==', TransactionPayloadType.INVALID_PAYMENT)
        .get();
      return creditSnap.length === 1;
    });
  });
});
