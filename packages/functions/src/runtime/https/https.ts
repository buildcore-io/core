/* eslint-disable @typescript-eslint/no-explicit-any */
import { WEN_FUNC } from '@build-5/interfaces';
import express from 'express';
import { AnySchema, ValidationOptions } from 'joi';
import { get } from 'lodash';
import { Context } from '../../controls/common';
import { WEN_FUNC_SCALE } from '../../scale.settings';
import { CloudFunctions, RuntimeOptions } from '../common';
import { auth } from './middlewares';

type HandlerType = (req: express.Request, res: express.Response) => Promise<void>;

type MiddlewareType = (
  req: express.Request,
  func: WEN_FUNC,
  schema: AnySchema<any>,
  options?: ValidationOptions,
  requireProjectApiKey?: boolean,
) => Promise<Context<any>>;

export class HttpsFunction extends CloudFunctions {
  constructor(
    public readonly func: HandlerType,
    options: RuntimeOptions,
  ) {
    super(options);
  }
}

interface OnRequest {
  name: WEN_FUNC;
  schema: AnySchema<any>;
  schemaOptions?: ValidationOptions;
  middleware?: MiddlewareType;
  handler: (context: Context<any>) => Promise<any>;
  requireProjectApiKey?: boolean;
}

export const onRequest = (params: OnRequest) => {
  const func = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const context = await (params.middleware || auth)(
        req,
        params.name,
        params.schema,
        params.schemaOptions,
        params.requireProjectApiKey,
      );
      const result = await params.handler(context);
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
  };
  return new HttpsFunction(func, { region: 'us-central1', ...WEN_FUNC_SCALE[params.name] });
};
