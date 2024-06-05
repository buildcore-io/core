import { Bucket } from '@buildcore/interfaces';
import Joi, { SchemaMap } from 'joi';
import { isEmpty } from 'lodash';
import { isProdEnv } from '../../utils/config.utils';

const minAddressLength = 42;
const maxAddressLength = 255;

export class CommonJoi {
  public static uid(required = true): Joi.StringSchema<string> {
    const base = Joi.string().alphanum().min(minAddressLength).max(maxAddressLength).lowercase();
    return required ? base.required() : base.allow(null, '');
  }
  public static storageUrl(required = true): Joi.StringSchema<string> {
    const base = Joi.string().custom((url: string, helpers) => {
      if (isStorageUrl(url)) {
        return url;
      }
      return helpers.error('string.uri');
    });
    return required ? base.required() : base.allow(null, '').optional();
  }

  public static tokenSymbol(required = true): Joi.StringSchema<string> {
    const base = Joi.string().min(2).max(5).regex(RegExp('^\\$?[A-Z]+$'));
    return required ? base.required() : base.optional();
  }
}

export const isStorageUrl = (url: string | undefined) =>
  !isEmpty(url) && startsWithBaseUrl(url || '');

export const BUCKET_BASE_URLS = {
  [Bucket.PROD]: 'https://' + Bucket.PROD + '/',
  [Bucket.TEST]: 'https://' + Bucket.TEST + '/',
};

const startsWithBaseUrl = (url: string) => {
  if (isProdEnv()) {
    return url.startsWith(BUCKET_BASE_URLS[Bucket.PROD]);
  }
  return url.startsWith(BUCKET_BASE_URLS[Bucket.TEST]);
};

export const getBuildcoreFromUri = (url: string) =>
  Object.values(BUCKET_BASE_URLS)
    .reduce((acc, act) => acc.replace(act, ''), url)
    .replace(/%2F/g, '/')
    .split('?')[0]
    .split('/')
    .slice(0, -1)
    .join('/');

export const toJoiObject = <T>(object: SchemaMap<T, true>) => Joi.object<T>(object);
