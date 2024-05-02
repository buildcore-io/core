import { AwardAddOwnerRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const addOwnerSchema = toJoiObject<AwardAddOwnerRequest>({
  uid: CommonJoi.uid().description('Buildcore id of the award.'),
  member: CommonJoi.uid().description(
    'Buildcore id or wallet address of the member to be added as an owner.',
  ),
})
  .description('Request object to add an owner for an existing award.')
  .meta({
    className: 'AwardAddOwnerRequest',
  });
