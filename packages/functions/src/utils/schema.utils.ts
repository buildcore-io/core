import { WenError } from '@build-5/interfaces';
import Joi, { AnySchema, ValidationResult } from 'joi';
import { head } from 'lodash';
import { isStorageUrl } from '../services/joi/common';
import { isProdEnv } from './config.utils';
import { invalidArgument } from './error.utils';
import { fileExists } from './storage.utils';

const assertValidation = (r: ValidationResult) => {
  if (r.error) {
    const detail = head(r.error.details);
    isProdEnv() && console.warn('invalid-argument', 'Invalid argument', { func: r.error });
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

export const cleanupParams = (obj: Record<string, unknown>) =>
  Object.entries(obj).reduce((acc, act) => ({ ...acc, [act[0]]: act[1] || null }), {});
