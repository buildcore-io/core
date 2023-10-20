import { AwardParticpateRequest } from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const awardParticipateSchema = toJoiObject<AwardParticpateRequest>({
  uid: CommonJoi.uid().description('Build5 id of the award'),
  comment: Joi.string().allow(null, '').optional().description('Reason for participation'),
})
  .description('Request object to partipate in an award')
  .meta({
    className: 'AwardParticpateRequest',
  });
