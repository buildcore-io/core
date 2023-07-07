import { SpaceCreateTangleRequest } from '@build-5/interfaces';
import Joi from 'joi';
import { createSpaceSchema } from '../../../../runtime/firebase/space/SpaceCreateRequestSchema';
import { toJoiObject } from '../../../joi/common';

export const createSpaceSchemaObject = toJoiObject<SpaceCreateTangleRequest>({
  ...createSpaceSchema,
  bannerUrl: Joi.string().uri().optional(),
})
  .description('Tangle request object to create a space.')
  .meta({
    className: 'SpaceCreateTangleRequest',
  });
