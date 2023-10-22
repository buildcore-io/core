/* eslint-disable @typescript-eslint/no-explicit-any */
import { SOON_PROJECT_ID, WEN_FUNC } from '@build-5/interfaces';
import express from 'express';
import { AnySchema, ValidationOptions } from 'joi';
import { Context } from '../../controls/common';
import { assertValidationAsync } from '../../utils/schema.utils';
import { decodeAuth } from '../../utils/wallet.utils';

export const auth = async (
  req: express.Request,
  func: WEN_FUNC,
  schema: AnySchema<any>,
  options?: ValidationOptions,
): Promise<Context<any>> => {
  const decoded = await decodeAuth(req.body.data, func, false);
  const owner = decoded.address.toLowerCase();
  const params = await assertValidationAsync(schema, decoded.body, options);
  return { ip: req.ip || '', owner, params, headers: req.headers, project: decoded.project };
};

export const memberCreate = async (req: express.Request): Promise<Context<any>> => {
  return {
    ip: req.ip || '',
    owner: req.body.data,
    params: {},
    headers: req.headers,
    project: SOON_PROJECT_ID,
  };
};
