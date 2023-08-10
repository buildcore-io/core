import { TokenStakeTangleRequest } from '@build-5/interfaces';
import { depositStakeSchema } from '../../../../runtime/firebase/stake/StakeTokenRequestSchema';
import { toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const depositStakeSchemaObject = toJoiObject<TokenStakeTangleRequest>({
  ...baseTangleSchema,
  ...depositStakeSchema,
})
  .description('Tangle request object to create a token stake order.')
  .meta({
    className: 'TokenStakeTangleRequest',
  });