import { WenError } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi, { AnySchema, ValidationResult } from 'joi';
import { get, head, toArray } from 'lodash';
import { BASE_STORAGE_URL } from '../services/joi/common';
import { isProdEnv } from './config.utils';
import { throwArgument } from './error.utils';
import { fileExistsInStorage } from './storage.utils';

export const pSchema = <T>(schema: Joi.ObjectSchema<T>, o: T, ignoreUnset: string[] = []) => {
  const entries = get(schema, '_ids')?._byKey?.entries();
  const keys = toArray(entries).map(head) as string[];
  return keys.reduce((acc, key) => {
    const value = get(o, key);
    return !value && ignoreUnset.includes(key) ? acc : { ...acc, [key]: value || null };
  }, {} as T);
};

const assertValidation = (r: ValidationResult) => {
  if (r.error) {
    isProdEnv() && functions.logger.warn('invalid-argument', 'Invalid argument', { func: r.error });
    throw throwArgument(
      'invalid-argument',
      WenError.invalid_params,
      JSON.stringify(r.error.details),
    );
  }
};

export const assertValidationAsync = async (
  schema: AnySchema,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any,
  options?: Joi.ValidationOptions,
) => {
  assertValidation(schema.validate(params, options));
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'string' || !value.startsWith(BASE_STORAGE_URL)) {
      continue;
    }
    if (!(await fileExistsInStorage(value))) {
      throw throwArgument('invalid-argument', WenError.invalid_params, `${key} is an invalid url`);
    }
  }
};

export const getDefaultParams = <T>() => <T>{};
