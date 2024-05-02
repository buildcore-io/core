import { TangleRequestType, VerifyEthForB5TangleRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const verifyEthForB5TangleSchema = toJoiObject<VerifyEthForB5TangleRequest>({
  ...baseTangleSchema(TangleRequestType.VERIFY_ETH_ADDRESS),
  ethAddress: CommonJoi.uid().description('Ethereum address.'),
})
  .description('Tangle request object to verify Ethereum address.')
  .meta({
    className: 'VerifyEthForB5TangleRequest',
  });
