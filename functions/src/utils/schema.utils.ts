import * as functions from 'firebase-functions';
import Joi, { ValidationResult } from "joi";
import { get, head } from 'lodash';
import { WenError } from './../../interfaces/errors';
import { throwArgument } from "./error.utils";

export const pSchema = <T,>(schema: Joi.ObjectSchema<T>, o: T, ignoreUnset: string[] = []) => {
  const keys = get(schema, '_ids')?._byKey?.entries()?.map(head) as string[];
  return keys.reduce((acc, key) => {
    const value = get(o, key);
    return !value && ignoreUnset.includes(key) ? acc : { ...acc, key: value || null };
  }, {} as T);
};


export function assertValidation(r: ValidationResult) {
  if (r.error) {
    functions.logger.warn('invalid-argument', "Invalid argument", {
      func: r.error
    });
    throw throwArgument('invalid-argument', WenError.invalid_params, JSON.stringify(r.error.details));
  }
}

export const getDefaultParams = <T>() => <T>{}
