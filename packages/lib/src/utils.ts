/* eslint-disable @typescript-eslint/no-explicit-any */
import dayjs from 'dayjs';
import { isEqual } from 'lodash';

export const processObjectArray = <T>(array: any[]) =>
  array.map((obj) => processObject(obj)) as T[];

export const processObject = <R>(obj: any) =>
  Object.entries(obj).reduce(
    (acc, [key, val]) => ({ ...acc, [key]: processValue(val) }),
    {} as Record<string, unknown>,
  ) as R;

const processValue = (value: any): any => {
  if (value instanceof Array) {
    return value.map(processValue);
  }
  if (value instanceof Object) {
    const keys = Object.keys(value);
    if (isEqual(keys, ['_seconds', '_nanoseconds'])) {
      return dayjs(value._nanoseconds);
    }
    return processObject(value);
  }
  return value;
};
