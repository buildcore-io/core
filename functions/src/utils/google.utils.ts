import * as functions from 'firebase-functions';
import { WenError } from '../../interfaces/errors';
import { AppCheck } from './../../interfaces/config';
import { throwArgument } from './error.utils';

export function appCheck(func: string, context: any) {
  if (context.app === undefined && AppCheck.enabled) {
    functions.logger.warn('failed-app-check', "The function must be called from an App Check verified app.", {
      func: func
    });

    throw throwArgument('invalid-argument', WenError.unapproved_site);
  }
}

