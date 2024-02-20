/* eslint-disable @typescript-eslint/no-explicit-any */

import { build5Db } from '@build-5/database';
import { COL, MIN_IOTA_AMOUNT, Network, TangleRequestType, Transaction } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { wait } from '../../test/controls/common';
import { getWallet } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';

describe('Transaction trigger spec', () => {
  it('Should not credit expired output', async () => {
    const wallet = await getWallet(Network.RMS);

    const address = await wallet.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.RMS, address.bech32, MIN_IOTA_AMOUNT);

    const tangleOrder = await getTangleOrder(Network.RMS);

    await wallet.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.BUY_TOKEN,
          symbol: 'SOON',
          count: 5,
          price: MIN_IOTA_AMOUNT,
        },
      },
      expiration: {
        expiresAt: dateToTimestamp(dayjs().subtract(1, 'd')),
        returnAddressBech32: address.bech32,
      },
    });

    await wait(async () => {
      const snap = await build5Db()
        .collection(COL.TRANSACTION)
        .where('member', '==', address.bech32)
        .get<Transaction>();
      return snap.length === 1 && snap[0].payload.invalidPayment;
    });

    await new Promise((r) => setTimeout(r, 2000));
    const snap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', address.bech32)
      .get();
    expect(snap.length).toBe(1);
  });
});
