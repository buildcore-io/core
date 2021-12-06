import * as functions from 'firebase-functions';
import { ValidationResult } from "joi";
import { WenError } from './../../interfaces/errors';
import { throwArgument } from "./error.utils";

export function pSchema(schema: any, o: any, ignoreUnset: string[] = []): any {
  // If no schema return null.
  if (!schema?._ids?._byKey?.entries()) {
    return {};
  }

  const output: any = {};
  for (const i of schema._ids._byKey.entries()) {
    if (i[0]) {
      if (ignoreUnset.includes(i[0])) {
        if (o[i[0]] === undefined) {
          continue;
        }

        output[i[0]] = o[i[0]];
      } else {
        // We must set null so FB unsets it.
        if (o[i[0]] === undefined) {
          output[i[0]] = null;
        } else {
          output[i[0]] = o[i[0]];
        }
      }
    }
  }

  return output;
}

export function assertValidation(r: ValidationResult): void {
  if (r.error) {
    functions.logger.warn('invalid-argument', "Invalid argument", {
      func: r.error
    });
    throw throwArgument('invalid-argument', WenError.invalid_params, r.error.details?.[0]?.type);
  }
}

export function getDefaultParams(): any {
  return {};
}
