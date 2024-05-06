import { MAX_TOTAL_TOKEN_SUPPLY, SwapCreateRequest } from '@buildcore/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';
import { AVAILABLE_NETWORKS } from '../common';

const nativeToken = {
  id: CommonJoi.uid(),
  amount: Joi.number().integer().min(0).max(MAX_TOTAL_TOKEN_SUPPLY).required(),
};

export const swapCreateSchemaObject = {
  nfts: Joi.array()
    .items(CommonJoi.uid(true))
    .min(1)
    .optional()
    .description('List of requested Buildcore NFT ids or NFT tangle ids'),

  baseTokenAmount: Joi.number()
    .integer()
    .min(0)
    .max(MAX_TOTAL_TOKEN_SUPPLY)
    .optional()
    .description('Requested base token amount'),

  nativeTokens: Joi.array()
    .items(Joi.object(nativeToken))
    .min(1)
    .optional()
    .description('Requested native token(s)'),

  recipient: CommonJoi.uid().description('Target member Buildcore uid or tangle address'),
};

export const swapCreateSchema = toJoiObject<SwapCreateRequest>({
  network: Joi.string()
    .equal(...AVAILABLE_NETWORKS)
    .required()
    .description('Network to use.'),
  ...swapCreateSchemaObject,
})
  .description('Request object to create a swap order.')
  .meta({
    className: 'SwapCreateRequest',
  });
