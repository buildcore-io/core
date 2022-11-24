import { WenError } from '@soonaverse/interfaces';
import Joi, { AnySchema } from 'joi';
import { isEmpty } from 'lodash';
import { getBucket } from '../../utils/config.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { fileExistsInStorage } from '../../utils/storage.utils';
import { ethAddressLength } from './../../utils/wallet.utils';

export const BASE_STORAGE_URL = `https://firebasestorage.googleapis.com/v0/b/${getBucket()}/o/`;

export class CommonJoi {
  public static uid(required = true): AnySchema {
    const base = Joi.string().alphanum().length(ethAddressLength).lowercase();
    return required ? base.required() : base;
  }
  public static storageUrl(required = true): AnySchema {
    const base = Joi.string().custom((url: string, helpers) => {
      if (!isEmpty(url) && !url.startsWith(BASE_STORAGE_URL)) {
        return helpers.error('Invalid url');
      }
      return url;
    });
    return required ? base.required() : base.allow(null, '').optional();
  }
}

export const assertFileExistsInStorage = async (url: string) => {
  if (!(await fileExistsInStorage(url))) {
    throw throwInvalidArgument(WenError.invalid_params);
  }
};
