import * as functions from 'firebase-functions';
import { FunctionsErrorCode } from "firebase-functions/v1/https";

interface Error {
  readonly key?: string;
}

export const throwArgument = (type: FunctionsErrorCode, err: Error, append = '') =>
  new functions.https.HttpsError(type, err.key + ' ' + append, err)

export const throwInvalidArgument = (err: Error) => throwArgument('invalid-argument', err);

export const throwUnAuthenticated = (err: Error) => throwArgument('unauthenticated', err)
