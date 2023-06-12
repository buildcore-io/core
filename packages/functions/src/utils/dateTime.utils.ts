import { Timestamp as ITimestamp } from '@build5/interfaces';
import dayjs from 'dayjs';
import { Timestamp } from 'firebase-admin/firestore';

export const dateToTimestamp = (d: dayjs.ConfigType, onlyDownToMinutes = false) => {
  const date = onlyDownToMinutes ? dayjs(d).second(0).millisecond(0) : dayjs(d);
  return Timestamp.fromDate(date.toDate()) as ITimestamp;
};

export const serverTime = () => dateToTimestamp(dayjs());
