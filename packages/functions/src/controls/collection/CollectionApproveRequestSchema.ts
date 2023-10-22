import { ApproveCollectionRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const approveCollectionSchema = toJoiObject<ApproveCollectionRequest>({
  uid: CommonJoi.uid().description('Build5 id of the collection.'),
})
  .description('Request object to approve a collection.')
  .meta({
    className: 'ApproveCollectionRequest',
  });
