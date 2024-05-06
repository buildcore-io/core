import { Timestamp as ITimestamp } from '@buildcore/interfaces';
import dayjs from 'dayjs';

export const dateToTimestamp = (d: dayjs.ConfigType, onlyDownToMinutes = false) => {
  const date = onlyDownToMinutes ? dayjs(d).second(0).millisecond(0) : dayjs(d);
  return ITimestamp.fromDate(date.toDate()) as ITimestamp;
};

export const serverTime = () => dateToTimestamp(dayjs());
