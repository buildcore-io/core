import { CreditUnrefundableRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const creditUnrefundableSchema = toJoiObject<CreditUnrefundableRequest>({
  transaction: CommonJoi.uid().description(
    'Buildcore id of the transaction to be unlocked and credited back.',
  ),
})
  .description('Request object to create a refund order.')
  .meta({
    className: 'CreditUnrefundableRequest',
  });
