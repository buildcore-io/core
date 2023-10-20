import { RejectCollectionRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const rejectCollectionSchema = toJoiObject<RejectCollectionRequest>({
  uid: CommonJoi.uid().description('Build5 id of the collection.'),
})
  .description('Request object to reject a collection.')
  .meta({
    className: 'RejectCollectionRequest',
  });
