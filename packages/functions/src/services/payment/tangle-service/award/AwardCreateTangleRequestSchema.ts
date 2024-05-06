import {
  AwardCreateBadgeRequest,
  AwardCreateTangleRequest,
  TangleRequestType,
} from '@buildcore/interfaces';
import Joi from 'joi';
import {
  awardBageSchema as baseAwardBageSchema,
  awardCreateSchema as baseAwardCreateSchema,
} from '../../../../controls/award/AwardCreateRequestSchema';
import { toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

const awardBageSchema = {
  ...baseAwardBageSchema,
  image: Joi.string().uri(),
};

export const awardCreateSchema = toJoiObject<AwardCreateTangleRequest>({
  ...baseTangleSchema(TangleRequestType.AWARD_CREATE),
  ...baseAwardCreateSchema,
  badge: toJoiObject<AwardCreateBadgeRequest>(awardBageSchema),
})
  .description('Tangle request object to create an award')
  .meta({
    className: 'AwardCreateTangleRequest',
  });
