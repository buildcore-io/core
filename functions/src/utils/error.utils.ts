import * as functions from 'firebase-functions';
import { FunctionsErrorCode, HttpsError } from "firebase-functions/v1/https";

export function throwInvalidArgument(err: any): HttpsError {
  return throwArgument('invalid-argument', err);
}

export function throwUnAuthenticated(err: any): HttpsError {
  return throwArgument('unauthenticated', err);
}

export function throwArgument(type: FunctionsErrorCode, err: any, append = ''): HttpsError {
  if (err && err.key) {
    return (new functions.https.HttpsError(
      type,
      err.key + ' ' + append,
      err)
    );
  } else {
    return (new functions.https.HttpsError(
      type,
      err.key + ' ' + append,
      err)
    );
  }
}
