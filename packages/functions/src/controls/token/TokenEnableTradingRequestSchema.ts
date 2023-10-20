import { EnableTokenTradingRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const enableTradingSchema = toJoiObject<EnableTokenTradingRequest>({
  uid: CommonJoi.uid().description('Build5 id of the token.'),
})
  .description('Request object to enable token trading.')
  .meta({
    className: 'EnableTokenTradingRequest',
  });
