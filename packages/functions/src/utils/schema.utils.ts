import { WenError } from '@build-5/interfaces';
import * as functions from 'firebase-functions/v2';
import Joi, { AnySchema, ValidationResult } from 'joi';
import { head } from 'lodash';
import { isStorageUrl } from '../services/joi/common';
import { isProdEnv } from './config.utils';
import { invalidArgument } from './error.utils';
import { fileExists } from './storage.utils';

const assertValidation = (r: ValidationResult) => {
  if (r.error) {
    const detail = head(r.error.details);
    isProdEnv() && functions.logger.warn('invalid-argument', 'Invalid argument', { func: r.error });
    throw invalidArgument(
      WenError.invalid_params,
      detail ? `${detail.message || ''}. ${detail.context?.message || ''}` : '',
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
    if (typeof value !== 'string' || !isStorageUrl(value) || (await fileExists(value))) {
      continue;
    }
    throw invalidArgument(WenError.invalid_params, `${key} is an invalid url`);
  }
};

export const cleanupParams = (obj: Record<string, unknown>) =>
  Object.entries(obj).reduce((acc, act) => ({ ...acc, [act[0]]: act[1] || null }), {});
