import { TangleRequestType, TokenStakeTangleRequest } from '@buildcore/interfaces';
import { depositStakeSchema } from '../../../../controls/stake/StakeTokenRequestSchema';
import { toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const depositStakeSchemaObject = toJoiObject<TokenStakeTangleRequest>({
  ...baseTangleSchema(TangleRequestType.STAKE),
  ...depositStakeSchema,
})
  .description('Tangle request object to create a token stake order.')
  .meta({
    className: 'TokenStakeTangleRequest',
  });
