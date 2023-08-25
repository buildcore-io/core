import { COL, TokenPurchase, TokenPurchaseAge } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { getAvgPrice } from '../../src/api/getAvgPrice';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { wait } from '../controls/common';

describe('Token price change', () => {
  it('Should get token price change', async () => {
    const token = getRandomEthAddress();

    const purchases = [
      {
        createdOn: dateToTimestamp(dayjs().subtract(1, 'h')),
        price: 1,
      },
      {
        createdOn: dateToTimestamp(dayjs().subtract(1, 'h')),
        price: 10,
      },
      { createdOn: dateToTimestamp(dayjs()), price: 5 },
    ].map((p) => ({ ...p, token, count: 0, uid: getRandomEthAddress() }));

    for (const p of purchases) {
      await build5Db().collection(COL.TOKEN_PURCHASE).doc(p.uid).create(p);
    }
    await wait(async () => {
      const purchases = await build5Db()
        .collection(COL.TOKEN_PURCHASE)
        .where('token', '==', token)
        .get<TokenPurchase>();
      return purchases.reduce(
        (acc, act) => acc && act.age && act.age[TokenPurchaseAge.IN_7_D],
        true,
      );
    });

    let result = 0;
    const req = { query: { token } } as any;
    const res = {
      send: (body: any) => {
        expect(body.avg.toFixed(2)).toBe('5.33');
        result = body.avg;
      },
    } as any;
    await getAvgPrice(req, res);

    await wait(async () => result !== 0);
  });
});
