import { WEN_FUNC } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { get } from 'lodash';
import { scale } from '../../scale.settings';
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
    functions.https.onRequest(
      { minInstances: scale(funcName), ...runtimeOptions },
      async (req, res) => {
        try {
          const params = await decodeAuth(req.body, funcName);
          const owner = params.address.toLowerCase();
          await assertValidationAsync(
            schema,
            validateOnlyUid ? { uid: params.body.uid } : params.body,
            joiOptions,
          );
          const result = await func(owner, params.body, { ip: req.ip });
          res.send(result);
        } catch (error) {
          res.status(get(error, 'httpErrorCode.status', 400));
          res.send(get(error, 'details', 'internal'));
        }
      },
    );
