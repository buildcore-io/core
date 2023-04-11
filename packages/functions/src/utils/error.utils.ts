import { FunctionsErrorCode } from 'firebase-functions/v1/https';
import * as functions from 'firebase-functions/v2';
interface Error {
  readonly key?: string;
}

const throwArgument = (type: FunctionsErrorCode, err: Error, append = '') =>
  new functions.https.HttpsError(type, err.key + ' ' + append, err);

export const invalidArgument = (err: Error, append = '') =>
  throwArgument('invalid-argument', err, append);

export const unAuthenticated = (err: Error) => throwArgument('unauthenticated', err);
