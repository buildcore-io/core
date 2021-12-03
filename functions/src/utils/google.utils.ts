import * as functions from 'firebase-functions';

export function appCheck(func: string, context: any) {
  if (context.app === undefined) {
    // throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    functions.logger.warn('failed-app-check', "The function must be called from an App Check verified app.", {
      func: func
    });
  }
}

