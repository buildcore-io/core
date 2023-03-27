import { WenRequest, WEN_FUNC } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { RuntimeOptions } from 'firebase-functions/v1';
import Joi from 'joi';
import { scale } from '../../scale.settings';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { decodeAuth } from '../../utils/wallet.utils';

export const onCall =
  (funcName: WEN_FUNC, runtimeOptions?: RuntimeOptions, joiOptions?: Joi.ValidationOptions) =>
  <P, R>(
    schema: Joi.Schema,
    func: (owner: string, params: P, customParams?: Record<string, unknown>) => Promise<R>,
    validateOnlyUid = false,
  ) =>
    functions
      .runWith({ minInstances: scale(funcName), ...runtimeOptions })
      .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
        appCheck(funcName, context);
        const params = await decodeAuth(req, funcName);
        const owner = params.address.toLowerCase();
        await assertValidationAsync(
          schema,
          validateOnlyUid ? { uid: params.body.uid } : params.body,
          joiOptions,
        );
        return await func(owner, params.body, { ip: context.rawRequest?.ip });
      });
