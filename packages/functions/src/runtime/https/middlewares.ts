/* eslint-disable @typescript-eslint/no-explicit-any */
import { CreateMemberRequest, WEN_FUNC, WenRequest } from '@build-5/interfaces';
import express from 'express';
import { AnySchema, ValidationOptions } from 'joi';
import { Context } from '../../controls/common';
import { assertValidationAsync } from '../../utils/schema.utils';
import { decodeAuth, getProject } from '../../utils/wallet.utils';

export const auth = async (
  req: express.Request,
  func: WEN_FUNC,
  schema: AnySchema<any>,
  options?: ValidationOptions,
  requireProjectApiKey?: boolean,
): Promise<Context<any>> => {
  const decoded = await decodeAuth(req.body.data, func, requireProjectApiKey);
  const owner = decoded.address.toLowerCase();
  const params = await assertValidationAsync(schema, decoded.body, options);
  return {
    ip: req.ip || '',
    owner,
    params,
    project: decoded.project,
    headers: req.headers,
    rawBody: req.body,
  };
};

export const createMember = async (req: express.Request): Promise<Context<any>> => {
  return {
    ip: req.ip || '',
    owner: (req.body.data as WenRequest<CreateMemberRequest>).body.address,
    params: {},
    project: getProject(req.body.data as WenRequest<unknown>),
    headers: req.headers,
    rawBody: req.body,
  };
};

export const uploadFile = async (req: express.Request): Promise<Context<any>> => {
  return {
    ip: req.ip || '',
    owner: '',
    params: {},
    project: '',
    headers: req.headers,
    rawBody: req.body,
  };
};
