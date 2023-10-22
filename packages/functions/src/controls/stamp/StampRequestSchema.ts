import { StampRequest } from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';
import { AVAILABLE_NETWORKS } from '../common';

export const stampSchema = toJoiObject<StampRequest>({
  file: Joi.string()
    .uri({ scheme: ['https', 'http'] })
    .required()
    .description('Url for the file.'),
  network: Joi.string()
    .valid(...AVAILABLE_NETWORKS)
    .required()
    .description('Network to use to fund the stamp order.'),
  aliasId: CommonJoi.uid(false).description(
    'Alias tangle id. The new nft will belong to this alias.',
  ),
})
  .description('Request object to stamp a file.')
  .meta({
    className: 'StampRequest',
  });
