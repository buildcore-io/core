import { database } from '@buildcore/database';
import { COL, TokenStatus, TokenTradeOrderStatus } from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { guardedRerun } from '../utils/common.utils';
import { cancelTradeOrderUtil } from '../utils/token-trade.utils';

export const tokenCoolDownOver = async () => {
  const tokens = await database()
    .collection(COL.TOKEN)
    .where('status', '==', TokenStatus.AVAILABLE)
    .where('coolDownEnd', '<=', dayjs().toDate())
    .get();
  const promises = tokens.map(async (token) => {
    const tokenDocRef = database().doc(COL.TOKEN, token.uid);
    await tokenDocRef.update({ status: TokenStatus.PROCESSING });
  });
  return Promise.allSettled(promises);
};

export const cancelExpiredSale = async () => {
  const runTransactions = () =>
    database().runTransaction(async (transaction) => {
      const snap = await database()
        .collection(COL.TOKEN_MARKET)
        .where('status', '==', TokenTradeOrderStatus.ACTIVE)
        .where('expiresAt', '<=', dayjs().toDate())
        .orderBy('expiresAt')
        .limit(150)
        .get();
      const docRefs = snap.map((order) => database().doc(COL.TOKEN_MARKET, order.uid));
      const promises = (isEmpty(docRefs) ? [] : await transaction.getAll(...docRefs))
        .filter((d) => d!.status === TokenTradeOrderStatus.ACTIVE)
        .map((d) => cancelTradeOrderUtil(transaction, d!, TokenTradeOrderStatus.EXPIRED));

      return (await Promise.all(promises)).length;
    });

  await guardedRerun(async () => (await runTransactions()) !== 0);
};
