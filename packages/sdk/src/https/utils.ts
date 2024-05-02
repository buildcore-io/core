/* eslint-disable @typescript-eslint/no-explicit-any */
import { Timestamp } from '@buildcore/interfaces';
import { isEqual } from 'lodash';

export const processObjectArray = <T>(array: any[]) =>
  array.map((obj) => processObject(obj)) as T[];

export const processObject = <R>(obj: any) => {
  const entries = Object.entries(obj);
  if (!entries.length) {
    return undefined;
  }
  return entries.reduce(
    (acc, [key, val]) => ({ ...acc, [key]: processValue(val) }),
    {} as Record<string, unknown>,
  ) as R;
};

const processValue = (value: any): any => {
  if (value && Array.isArray(value)) {
    return value.map(processValue);
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (isEqual(keys, ['seconds', 'nanoseconds'])) {
      return new Timestamp(value.seconds, value.nanoseconds);
    }
    return processObject(value);
  }
  return value;
};

export const randomString = (length = 16) => {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0154326789';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }
  return result;
};
