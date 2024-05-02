import { SwapCreateTangleRequest, TangleRequestType } from '@buildcore/interfaces';
import Joi from 'joi';
import { swapCreateSchemaObject } from '../../../../controls/swaps/SwapCreateRequestSchema';
import { toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const swapCreateTangleSchema = toJoiObject<SwapCreateTangleRequest>({
  ...baseTangleSchema(TangleRequestType.CREATE_SWAP),
  ...swapCreateSchemaObject,
  setFunded: Joi.boolean()
    .optional()
    .description('If set to true swap order will be set to funded upon creation'),
})
  .description('Tangle request object to create a swap order.')
  .meta({
    className: 'SwapCreateTangleRequest',
  });
