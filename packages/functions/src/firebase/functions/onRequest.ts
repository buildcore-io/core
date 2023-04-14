import { WEN_FUNC } from '@soonaverse/interfaces';
import cors from 'cors';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { get } from 'lodash';
import { scale } from '../../scale.settings';
import { isEmulatorEnv } from '../../utils/config.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { decodeAuth } from '../../utils/wallet.utils';

export const onRequest =
  (
    funcName: WEN_FUNC,
    runtimeOptions?: functions.https.CallableOptions,
    joiOptions?: Joi.ValidationOptions,
  ) =>
  <P, R>(
    schema: Joi.Schema,
    func: (owner: string, params: P, customParams?: Record<string, unknown>) => Promise<R>,
    validateOnlyUid = false,
  ) =>
    functions.https.onRequest(getConfig(funcName, runtimeOptions), (req, res) =>
      cors({ origin: true })(req, res, async () => {
        try {
          const params = await decodeAuth(req.body.data, funcName);
          const owner = params.address.toLowerCase();
          await assertValidationAsync(
            schema,
            validateOnlyUid ? { uid: params.body.uid } : params.body,
            joiOptions,
          );
          const result = await func(owner, params.body, { ip: req.ip });
          res.send({ data: result || {} });
        } catch (error) {
          res.status(get(error, 'httpErrorCode.status', 400));
          res.send({ data: error });
        }
      }),
    );

export const getConfig = (funcName: WEN_FUNC, runtimeOptions?: functions.https.CallableOptions) => {
  const config: functions.https.CallableOptions = { minInstances: scale(funcName) };
  if (!isEmulatorEnv) {
    config.cors = true;
  }
  return { ...config, ...runtimeOptions };
};
