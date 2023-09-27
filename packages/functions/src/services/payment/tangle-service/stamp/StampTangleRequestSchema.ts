import { StampTangleRequest, TangleRequestType } from '@build-5/interfaces';
import Joi from 'joi';
import { AVAILABLE_NETWORKS } from '../../../../controls/common';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const stampTangleSchema = toJoiObject<StampTangleRequest>({
  ...baseTangleSchema(TangleRequestType.STAMP),
  uri: Joi.string()
    .uri({ scheme: ['https', 'http'] })
    .required()
    .description('Url for the file.'),
  network: Joi.string()
    .valid(...AVAILABLE_NETWORKS)
    .description('Network to use to fund the stamp order.'),
  aliasId: CommonJoi.uid(false).description(
    'Alias tangle id. The new nft will belong to this alias.',
  ),
})
  .description('Tangle request object to stamp a file.')
  .meta({
    className: 'StampTangleRequest',
  });
