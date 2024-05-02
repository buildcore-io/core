import { CreateMemberRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const createMemberSchema = toJoiObject<CreateMemberRequest>({
  address: CommonJoi.uid().description('Wallet address of the member'),
})
  .description('Request object to create a member')
  .meta({
    className: 'CreateMemberRequest',
  });
