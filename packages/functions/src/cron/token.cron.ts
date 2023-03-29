import {
  COL,
  Token,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { soonDb } from '../firebase/firestore/soondb';
import { guardedRerun } from '../utils/common.utils';
import { dateToTimestamp, serverTime } from '../utils/dateTime.utils';
import { cancelTradeOrderUtil } from '../utils/token-trade.utils';

export const tokenCoolDownOver = async () => {
  const tokens = await soonDb()
    .collection(COL.TOKEN)
    .where('status', '==', TokenStatus.AVAILABLE)
    .where('coolDownEnd', '<=', dateToTimestamp(dayjs().toDate()))
    .get<Token>();
  const promises = tokens.map((token) => {
    const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${token.uid}`);
    tokenDocRef.update({ status: TokenStatus.PROCESSING });
  });
  return Promise.allSettled(promises);
};

export const cancelExpiredSale = async () => {
  const runTransaction = () =>
    soonDb().runTransaction(async (transaction) => {
      const snap = await soonDb()
        .collection(COL.TOKEN_MARKET)
        .where('status', '==', TokenTradeOrderStatus.ACTIVE)
        .where('expiresAt', '<=', serverTime())
        .orderBy('expiresAt')
        .limit(150)
        .get<TokenTradeOrder>();
      const docRefs = snap.map((order) => soonDb().doc(`${COL.TOKEN_MARKET}/${order.uid}`));
      const promises = (
        isEmpty(docRefs) ? [] : await transaction.getAll<TokenTradeOrder>(...docRefs)
      )
        .filter((d) => d!.status === TokenTradeOrderStatus.ACTIVE)
        .map((d) => cancelTradeOrderUtil(transaction, d!, TokenTradeOrderStatus.EXPIRED));

      return (await Promise.all(promises)).length;
    });

  await guardedRerun(async () => (await runTransaction()) !== 0);
};
