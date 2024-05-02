import { Timestamp } from '@buildcore/interfaces';
import { isNull, isUndefined } from 'lodash';

export const removeNulls = <T>(data: T) => {
  const result: T = Object.entries(data as any).reduce((acc, [key, value]) => {
    if (isNull(value) || isUndefined(value)) {
      return acc;
    }
    if (value instanceof Timestamp || Array.isArray(value)) {
      return { ...acc, [key]: value };
    }
    if (value instanceof Object) {
      return { ...acc, [key]: removeNulls(value) };
    }
    return { ...acc, [key]: value };
  }, {} as T);
  return result;
};

export const undefinedToNull = <T>(data: T) => {
  const result: T = Object.entries(data as any).reduce((acc, [key, value]) => {
    if (isNull(value) || isUndefined(value)) {
      return { ...acc, [key]: null };
    }
    return { ...acc, [key]: value };
  }, {} as T);
  return result;
};
