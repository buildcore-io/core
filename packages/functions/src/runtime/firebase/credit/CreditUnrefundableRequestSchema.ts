import { CreditUnrefundableRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../services/joi/common';

export const creditUnrefundableSchema = toJoiObject<CreditUnrefundableRequest>({
  transaction: CommonJoi.uid().description(
    'Build5 id of the transaction to be unlocked and credited back.',
  ),
})
  .description('Request object to create a refund order.')
  .meta({
    className: 'CreditUnrefundableRequest',
  });
