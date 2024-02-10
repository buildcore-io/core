import { Bucket } from '@build-5/interfaces';
import Joi, { SchemaMap } from 'joi';
import { isEmpty } from 'lodash';
import { isEmulatorEnv, isProdEnv } from '../../utils/config.utils';

const minAddressLength = 42;
const maxAddressLength = 255;

export class CommonJoi {
  public static uid(required = true): Joi.StringSchema<string> {
    const base = Joi.string().alphanum().min(minAddressLength).max(maxAddressLength).lowercase();
    return required ? base.required() : base;
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
  !isEmpty(url) && startsWithBaseUrl(url || '') && (isEmulatorEnv() || !url?.includes('?'));

export const BUCKET_BASE_URLS = {
  [Bucket.PROD]: 'https://' + Bucket.PROD + '/',
  [Bucket.TEST]: 'https://' + Bucket.TEST + '/',
  [Bucket.DEV]: `https://firebasestorage.googleapis.com/v0/b/${Bucket.DEV}/o/`,
  local: `http://127.0.0.1:9199/download/storage/v1/b/soonaverse-dev-custom-bucket/o/`,
};

const startsWithBaseUrl = (url: string) => {
  if (isEmulatorEnv()) {
    return (
      url.startsWith(BUCKET_BASE_URLS[Bucket.DEV]) ||
      url.startsWith(BUCKET_BASE_URLS[Bucket.TEST]) ||
      url.startsWith(BUCKET_BASE_URLS['local'])
    );
  }
  if (isProdEnv()) {
    return url.startsWith(BUCKET_BASE_URLS[Bucket.PROD]);
  }
  return url.startsWith(BUCKET_BASE_URLS[Bucket.TEST]);
};

export const getBuild5FromUri = (url: string) =>
  Object.values(BUCKET_BASE_URLS)
    .reduce((acc, act) => acc.replace(act, ''), url)
    .replace(/%2F/g, '/')
    .split('?')[0]
    .split('/')
    .slice(0, -1)
    .join('/');

export const toJoiObject = <T>(object: SchemaMap<T, true>) => Joi.object<T>(object);
