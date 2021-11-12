import Joi, { ValidationResult } from "joi";
import { WenError } from './../../interfaces/errors';
import { throwArgument } from "./error.utils";

export function pSchema(schema: any, o: any): any {
  // If no schema return null.
  if (!schema?._ids?._byKey?.entries()) {
    return {};
  }

  const output: any = {};
  for (const i of schema._ids._byKey.entries()) {
    if (i[0]) {
      // We must set null so FB unsets it.
      output[i[0]] = o[i[0]] || null;
    }
  }

  return output;
}

export function assertValidation(r: ValidationResult): void {
  if (r.error) {
    throw throwArgument('invalid-argument', WenError.invalid_params, JSON.stringify(r.error.details));
  }
}

export function getDefaultParams(): any {
  // TODO We need to figure if we want to validate this further.
  return {
    'web3-token-version': Joi.number().optional(),
    'expire-date': Joi.date().greater('now').optional()
  };
}
