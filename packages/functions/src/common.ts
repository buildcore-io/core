/* eslint-disable @typescript-eslint/no-explicit-any */
import { CloudFunctions } from './runtime/common';

export const flattenObject = (obj: any): { [key: string]: any } => {
  const flat: { [key: string]: any } = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value instanceof CloudFunctions) {
      flat[key] = value;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      const nestedObj = flattenObject(value);
      for (const nestedKey of Object.keys(nestedObj)) {
        flat[nestedKey] = nestedObj[nestedKey];
      }
    }
  });
  return flat;
};
