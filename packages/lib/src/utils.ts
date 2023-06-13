/* eslint-disable @typescript-eslint/no-explicit-any */
import { Timestamp } from '@build-5/interfaces';
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
      return new Timestamp(value._seconds, value._nanoseconds);
    }
    return processObject(value);
  }
  return value;
};

export const randomString = (length = 16) => {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }
  return result;
};
