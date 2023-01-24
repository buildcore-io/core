import { WenRequest, WEN_FUNC } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { RuntimeOptions } from 'firebase-functions/v1';
import Joi from 'joi';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { decodeAuth } from '../../utils/wallet.utils';

export const onCall =
  (runtimeOptions?: RuntimeOptions) =>
  <P, R>(
    funcName: WEN_FUNC,
    schema: Joi.Schema,
    func: (owner: string, params: P, customParams?: Record<string, unknown>) => Promise<R>,
  ) =>
    functions
      .runWith(runtimeOptions || {})
      .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
        appCheck(funcName, context);
        const params = await decodeAuth(req, funcName);
        const owner = params.address.toLowerCase();
        await assertValidationAsync(schema, params.body);
        return await func(owner, params.body, { ip: context.rawRequest?.ip });
      });
