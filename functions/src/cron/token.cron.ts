
import dayjs from 'dayjs';
import * as admin from 'firebase-admin';
import { isEmpty } from 'lodash';
import { COL } from '../../interfaces/models/base';
import { TokenBuySellOrder, TokenBuySellOrderStatus, TokenStatus } from '../../interfaces/models/token';
import { guardedRerun } from '../utils/common.utils';
import { dateToTimestamp } from '../utils/dateTime.utils';
import { cancelSale } from '../utils/token-buy-sell.utils';

export const tokenCoolDownOver = async () => {
  const tokens = await admin.firestore().collection(`${COL.TOKEN}`)
    .where('status', '==', TokenStatus.AVAILABLE)
    .where('coolDownEnd', '<=', dateToTimestamp(dayjs().toDate()))
    .get();
  const promises = tokens.docs.map(doc => doc.ref.update({ status: TokenStatus.PROCESSING }));
  return Promise.allSettled(promises)
}

export const cancelExpiredSale = async () => {
  const runTransaction = () => admin.firestore().runTransaction(async (transaction) => {
    const query = admin.firestore().collection(COL.TOKEN_MARKET)
      .where('status', '==', TokenBuySellOrderStatus.ACTIVE)
      .where('expiresAt', '<=', dateToTimestamp(dayjs()))
      .orderBy('expiresAt')
      .limit(150)
    const docRefs = (await query.get()).docs.map(d => d.ref)
    const promises = (isEmpty(docRefs) ? [] : await transaction.getAll(...docRefs))
      .map(d => <TokenBuySellOrder>d.data())
      .filter(d => d.status === TokenBuySellOrderStatus.ACTIVE)
      .map(d => cancelSale(transaction, d, TokenBuySellOrderStatus.EXPIRED))

    return (await Promise.all(promises)).length
  })

  await guardedRerun(async () => await runTransaction() !== 0)
}
