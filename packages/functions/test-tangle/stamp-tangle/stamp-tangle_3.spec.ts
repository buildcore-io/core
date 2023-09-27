import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Stamp,
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
    let stamp = await stampDocRef.get<Stamp>();
    await wait(async () => {
      stamp = await stampDocRef.get<Stamp>();
      return stamp?.nftId !== undefined;
    });

    const expiresAfter30Days = dayjs(stamp?.expiresAt.toDate()).isAfter(now.add(8.64e7));
    expect(expiresAfter30Days).toBe(true);

    thirtyDayCost = (creditResponse.dailyCost as number) * 30;
    await helper.wallet!.send(helper.address, creditResponse.address as string, thirtyDayCost, {});
    await MnemonicService.store(helper.address.bech32, helper.address.mnemonic);

    await wait(async () => {
      stamp = await stampDocRef.get<Stamp>();
      const expiresAfter60Days = dayjs(stamp?.expiresAt.toDate()).isAfter(now.add(60 * 8.64e7));
      return expiresAfter60Days;
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const snap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.STAMP)
      .get();
    expect(snap.length).toBe(2);

    await stampDocRef.update({ expiresAt: dayjs().subtract(1, 'h').toDate() });
    await updateExpiredStamp();
    stamp = await stampDocRef.get<Stamp>();
    expect(stamp?.expired).toBe(true);

    thirtyDayCost = (creditResponse.dailyCost as number) * 30;
    await helper.wallet!.send(helper.address, creditResponse.address as string, thirtyDayCost, {});
    await MnemonicService.store(helper.address.bech32, helper.address.mnemonic);

    await wait(async () => {
      const creditSnap = await build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('payload.type', '==', TransactionPayloadType.INVALID_PAYMENT)
        .get();
      return creditSnap.length === 1;
    });
  });
});
