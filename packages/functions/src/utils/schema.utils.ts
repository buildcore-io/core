import { WenError } from '@buildcore/interfaces';
import Joi, { AnySchema, ValidationResult } from 'joi';
import { head } from 'lodash';
import { isStorageUrl } from '../services/joi/common';
import { isProdEnv } from './config.utils';
import { invalidArgument } from './error.utils';
import { logger } from './logger';
import { fileExists } from './storage.utils';

const assertValidation = (r: ValidationResult) => {
  if (r.error) {
    const detail = head(r.error.details);
    isProdEnv() && logger.warn('Invalid argument  warning', { func: r.error });
    throw invalidArgument(
      WenError.invalid_params,
      detail ? `${detail.message || ''}. ${detail.context?.message || ''}` : '',
    );
  }
};

export const assertValidationAsync = async <T>(
  schema: AnySchema<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any,
  options?: Joi.ValidationOptions,
) => {
  const validationResult = schema.validate(params, options);
  assertValidation(validationResult);
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'string' || !isStorageUrl(value) || (await fileExists(value))) {
      continue;
    }
    throw invalidArgument(WenError.invalid_params, `${key} is an invalid url`);
  }
  return validationResult.value! as T;
};

export const cleanupParams = <T>(obj: T): T =>
  Object.entries(obj as Record<string, unknown>).reduce(
    (acc, act) => ({ ...acc, [act[0]]: act[1] || null }),
    {},
  ) as T;
