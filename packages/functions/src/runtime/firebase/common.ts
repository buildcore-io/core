import { NetworkAddress, WEN_FUNC } from '@build-5/interfaces';
import cors from 'cors';
import * as functions from 'firebase-functions/v2';
import { HttpsOptions } from 'firebase-functions/v2/https';
import Joi from 'joi';
import { get } from 'lodash';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { isEmulatorEnv } from '../../utils/config.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { decodeAuth } from '../../utils/wallet.utils';

export interface UidSchemaObject {
  uid: NetworkAddress;
}
export const uidSchema = { uid: CommonJoi.uid() };

export interface Context {
  ip: string;
  owner: string;
  project: string;
}

export const onRequest =
  (
    funcName: WEN_FUNC,
    runtimeOptions?: functions.https.CallableOptions,
    joiOptions?: Joi.ValidationOptions,
  ) =>
  <P, R>(
    schema: Joi.AnySchema<P>,
    func: (context: Context, params: P) => Promise<R>,
    validateOnlyUid = false,
    projectIsRequired = false,
  ) =>
    functions.https.onRequest(onRequestConfig(funcName, runtimeOptions), (req, res) =>
      cors({ origin: true })(req, res, async () => {
        try {
          const params = await decodeAuth(req.body.data, funcName, projectIsRequired);
          const owner = params.address.toLowerCase();
          await assertValidationAsync(
            schema,
            validateOnlyUid ? { uid: params.body.uid } : params.body,
            joiOptions,
          );
          const context = { ip: req.ip || '', owner, project: params.project };
          const result = await func(context, params.body);
          res.send({ data: result || {} });
        } catch (error) {
          res.status(get(error, 'httpErrorCode.status', 400));
          res.send({
            data: {
              code: get(error, 'details.code', 0),
              key: get(error, 'details.key', ''),
              message: get(error, 'message', ''),
            },
          });
        }
      }),
    );

export const onRequestConfig = (
  funcName: WEN_FUNC,
  runtimeOptions?: functions.https.CallableOptions,
) => {
  const config: HttpsOptions = {
    ingressSettings: 'ALLOW_INTERNAL_AND_GCLB',
    minInstances: scale(funcName),
  };
  if (!isEmulatorEnv()) {
    config.cors = true;
  }
  return {
    ...config,
    ...runtimeOptions,
  } as HttpsOptions;
};
