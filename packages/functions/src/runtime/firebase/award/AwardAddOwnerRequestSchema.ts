import { AwardAddOwnerRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../services/joi/common';

export const addOwnerSchema = toJoiObject<AwardAddOwnerRequest>({
  uid: CommonJoi.uid().description('Build5 id of the award.'),
  member: CommonJoi.uid().description(
    'Build5 id or wallet address of the member to be added as an owner.',
  ),
})
  .description('Request object to add an owner for an existing award.')
  .meta({
    className: 'AwardAddOwnerRequest',
  });
