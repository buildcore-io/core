import { RejectCollectionRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const rejectCollectionSchema = toJoiObject<RejectCollectionRequest>({
  uid: CommonJoi.uid().description('Buildcore id of the collection.'),
})
  .description('Request object to reject a collection.')
  .meta({
    className: 'RejectCollectionRequest',
  });
