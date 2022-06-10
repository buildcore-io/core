import * as functions from 'firebase-functions';
import { WenError } from '../../interfaces/errors';
import { AppCheck } from './../../interfaces/config';
import { isProdEnv } from './config.utils';
import { throwArgument } from './error.utils';

const APP_CHECK_ERROR = "The function must be called from an App Check verified app."

export function appCheck(func: string, context: functions.https.CallableContext) {
  if (!context.app && AppCheck.enabled && isProdEnv()) {
    functions.logger.warn('failed-app-check', APP_CHECK_ERROR, { func });
    throw throwArgument('invalid-argument', WenError.unapproved_site);
  }
}

