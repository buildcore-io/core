import { Bucket } from '@build-5/interfaces';
import Joi, { AnySchema } from 'joi';
import { isEmpty } from 'lodash';
import { isEmulatorEnv, isProdEnv } from '../../utils/config.utils';
import { maxAddressLength, minAddressLength } from './../../utils/wallet.utils';

export class CommonJoi {
  public static uid(required = true): AnySchema {
    const base = Joi.string().alphanum().min(minAddressLength).max(maxAddressLength).lowercase();
    return required ? base.required() : base;
  }
  public static storageUrl(required = true): AnySchema {
    const base = Joi.string().custom((url: string, helpers) => {
      if (isStorageUrl(url)) {
        return url;
      }
      return helpers.error('string.uri');
    });
    return required ? base.required() : base.allow(null, '').optional();
  }
  public static sessionId = (required = false) => {
    const base = Joi.string().alphanum().min(1).max(100);
    return required ? base.required() : base.optional();
  };
  public static tokenSymbol(): AnySchema {
    return Joi.string().min(2).max(5).regex(RegExp('^\\$?[A-Z]+$')).required();
  }
}

export const isStorageUrl = (url: string | undefined) =>
  !isEmpty(url) && startsWithBaseUrl(url || '') && (isEmulatorEnv() || !url?.includes('?'));

const BASE_URLS = {
  [Bucket.PROD]: 'https://' + Bucket.PROD,
  [Bucket.TEST]: 'https://' + Bucket.TEST,
  [Bucket.DEV]: `https://firebasestorage.googleapis.com/v0/b/${Bucket.DEV}/o/`,
};

const startsWithBaseUrl = (url: string) => {
  if (isEmulatorEnv()) {
    return url.startsWith(BASE_URLS[Bucket.DEV]) || url.startsWith(BASE_URLS[Bucket.TEST]);
  }
  if (isProdEnv()) {
    return url.startsWith(BASE_URLS[Bucket.PROD]);
  }
  return url.startsWith(BASE_URLS[Bucket.TEST]);
};
