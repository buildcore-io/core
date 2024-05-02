import { StampTangleRequest, TangleRequestType } from '@buildcore/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const stampTangleSchema = toJoiObject<StampTangleRequest>({
  ...baseTangleSchema(TangleRequestType.STAMP),
  uri: Joi.string()
    .uri({ scheme: ['https', 'http'] })
    .required()
    .description('Url for the file.'),
  aliasId: CommonJoi.uid(false).description(
    'Alias tangle id. The new nft will belong to this alias.',
  ),
  days: Joi.number()
    .integer()
    .min(1)
    .optional()
    .description(
      'If specified, system will only use token amount for that exact period and refund the rest. ' +
        'Otherwise, it’ll use whatever it can.',
    ),
})
  .description('Tangle request object to stamp a file.')
  .meta({
    className: 'StampTangleRequest',
  });
