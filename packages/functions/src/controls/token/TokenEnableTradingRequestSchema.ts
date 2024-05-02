import { EnableTokenTradingRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const enableTradingSchema = toJoiObject<EnableTokenTradingRequest>({
  uid: CommonJoi.uid().description('Buildcore id of the token.'),
})
  .description('Request object to enable token trading.')
  .meta({
    className: 'EnableTokenTradingRequest',
  });
