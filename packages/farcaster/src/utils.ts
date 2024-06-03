import { Dayjs } from 'dayjs';

export const dateBetween = (date: Dayjs, after: Dayjs, before: Dayjs) =>
  date.isAfter(after) && date.isBefore(before);
