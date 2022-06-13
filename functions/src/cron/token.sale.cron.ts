
import dayjs from 'dayjs';
import { COL } from '../../interfaces/models/base';
import { TokenBuySellOrderStatus } from '../../interfaces/models/token';
import admin from '../admin.config';
import { dateToTimestamp } from '../utils/dateTime.utils';

export const retryOpenBuySellOrders = async () => {
  const snap = await admin.firestore().collection(COL.TOKEN_MARKET)
    .where('status', '==', TokenBuySellOrderStatus.ACTIVE)
    .where('createdOn', '<=', dateToTimestamp(dayjs().subtract(1, 'h')))
    .get()
  const promises = snap.docs.filter(d => !d.data()?.shouldRetry).map(d => {
    admin.firestore().doc(`${COL.TOKEN_MARKET}/${d.id}`).update({ shouldRetry: true })
  })
  await Promise.all(promises)
}
