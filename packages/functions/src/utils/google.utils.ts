import { AppCheck, WenError } from '@build-5/interfaces';
import * as functions from 'firebase-functions/v2';
import { isProdEnv } from './config.utils';
import { invalidArgument } from './error.utils';

const APP_CHECK_ERROR = 'The function must be called from an App Check verified app.';

export function appCheck(func: string, request: functions.https.CallableRequest) {
  if (!request.app && AppCheck.enabled && isProdEnv()) {
    functions.logger.warn('failed-app-check', APP_CHECK_ERROR, { func });
    throw invalidArgument(WenError.unapproved_site);
  }
}
