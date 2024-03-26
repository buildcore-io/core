import { build5Db } from '@build-5/database';
import { COL, TokenStatus, TokenTradeOrderStatus } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { guardedRerun } from '../utils/common.utils';
import { cancelTradeOrderUtil } from '../utils/token-trade.utils';

export const tokenCoolDownOver = async () => {
  const tokens = await build5Db()
    .collection(COL.TOKEN)
    .where('status', '==', TokenStatus.AVAILABLE)
    .where('coolDownEnd', '<=', dayjs().toDate())
    .get();
  const promises = tokens.map(async (token) => {
    const tokenDocRef = build5Db().doc(COL.TOKEN, token.uid);
    await tokenDocRef.update({ status: TokenStatus.PROCESSING });
  });
  return Promise.allSettled(promises);
};

export const cancelExpiredSale = async () => {
  const runTransactions = () =>
    build5Db().runTransaction(async (transaction) => {
      const snap = await build5Db()
        .collection(COL.TOKEN_MARKET)
        .where('status', '==', TokenTradeOrderStatus.ACTIVE)
        .where('expiresAt', '<=', dayjs().toDate())
        .orderBy('expiresAt')
        .limit(150)
        .get();
      const docRefs = snap.map((order) => build5Db().doc(COL.TOKEN_MARKET, order.uid));
      const promises = (isEmpty(docRefs) ? [] : await transaction.getAll(...docRefs))
        .filter((d) => d!.status === TokenTradeOrderStatus.ACTIVE)
        .map((d) => cancelTradeOrderUtil(transaction, d!, TokenTradeOrderStatus.EXPIRED));

      return (await Promise.all(promises)).length;
    });

  await guardedRerun(async () => (await runTransactions()) !== 0);
};
