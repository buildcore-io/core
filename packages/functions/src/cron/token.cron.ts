import {
  COL,
  Token,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { build5Db } from '../firebase/firestore/build5Db';
import { guardedRerun } from '../utils/common.utils';
import { dateToTimestamp, serverTime } from '../utils/dateTime.utils';
import { cancelTradeOrderUtil } from '../utils/token-trade.utils';

export const tokenCoolDownOver = async () => {
  const tokens = await build5Db()
    .collection(COL.TOKEN)
    .where('status', '==', TokenStatus.AVAILABLE)
    .where('coolDownEnd', '<=', dateToTimestamp(dayjs().toDate()))
    .get<Token>();
  const promises = tokens.map((token) => {
    const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${token.uid}`);
    tokenDocRef.update({ status: TokenStatus.PROCESSING });
  });
  return Promise.allSettled(promises);
};

export const cancelExpiredSale = async () => {
  const runTransaction = () =>
    build5Db().runTransaction(async (transaction) => {
      const snap = await build5Db()
        .collection(COL.TOKEN_MARKET)
        .where('status', '==', TokenTradeOrderStatus.ACTIVE)
        .where('expiresAt', '<=', serverTime())
        .orderBy('expiresAt')
        .limit(150)
        .get<TokenTradeOrder>();
      const docRefs = snap.map((order) => build5Db().doc(`${COL.TOKEN_MARKET}/${order.uid}`));
      const promises = (
        isEmpty(docRefs) ? [] : await transaction.getAll<TokenTradeOrder>(...docRefs)
      )
        .filter((d) => d!.status === TokenTradeOrderStatus.ACTIVE)
        .map((d) => cancelTradeOrderUtil(transaction, d!, TokenTradeOrderStatus.EXPIRED));

      return (await Promise.all(promises)).length;
    });

  await guardedRerun(async () => (await runTransaction()) !== 0);
};
