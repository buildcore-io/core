import { SpaceCreateTangleRequest, TangleRequestType } from '@buildcore/interfaces';
import Joi from 'joi';
import { createSpaceSchema } from '../../../../controls/space/SpaceCreateRequestSchema';
import { toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const createSpaceSchemaObject = toJoiObject<SpaceCreateTangleRequest>({
  ...baseTangleSchema(TangleRequestType.SPACE_CREATE),
  ...createSpaceSchema,
  bannerUrl: Joi.string().uri().optional(),
})
  .description('Tangle request object to create a space.')
  .meta({
    className: 'SpaceCreateTangleRequest',
  });
