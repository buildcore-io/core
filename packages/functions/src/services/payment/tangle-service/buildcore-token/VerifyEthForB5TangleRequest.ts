import { TangleRequestType, VerifyEthForB5TangleRequest } from '@buildcore/interfaces';
import Joi from 'joi';
import { toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

const maxAddressLength = 10 * 255;
export const verifyEthForB5TangleSchema = toJoiObject<VerifyEthForB5TangleRequest>({
  ...baseTangleSchema(TangleRequestType.VERIFY_ETH_ADDRESS),

  ethAddress: Joi.string()
    .regex(/^[a-zA-Z0-9,]+$/)
    .max(maxAddressLength)
    .lowercase()
    .description('Ethereum address.')
    .required(),
})
  .description('Tangle request object to verify Ethereum address.')
  .meta({
    className: 'VerifyEthForB5TangleRequest',
  });
