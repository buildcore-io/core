import { FunctionsErrorCode } from 'firebase-functions/v1/https';
import * as functions from 'firebase-functions/v2';
interface Error {
  readonly key?: string;
}

export const throwArgument = (type: FunctionsErrorCode, err: Error, append = '') =>
  new functions.https.HttpsError(type, err.key + ' ' + append, err);

export const throwInvalidArgument = (err: Error) => throwArgument('invalid-argument', err);

export const throwUnAuthenticated = (err: Error) => throwArgument('unauthenticated', err);
