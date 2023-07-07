import { AwardCreateBadgeRequest, AwardCreateTangleRequest } from '@build-5/interfaces';
import Joi from 'joi';
import {
  awardBageSchema as baseAwardBageSchema,
  awardCreateSchema as baseAwardCreateSchema,
} from '../../../../runtime/firebase/award/AwardCreateRequestSchema';
import { toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

const awardBageSchema = {
  ...baseAwardBageSchema,
  image: Joi.string().uri(),
};

export const awardCreateSchema = toJoiObject<AwardCreateTangleRequest>({
  ...baseTangleSchema,
  ...baseAwardCreateSchema,
  badge: toJoiObject<AwardCreateBadgeRequest>(awardBageSchema),
})
  .description('Tangle request object to create an award')
  .meta({
    className: 'AwardCreateTangleRequest',
  });
