import { WEN_FUNC } from '@build-5/interfaces';
import { mintCollectionOrderControl } from '../../../controls/collection/collection-mint.control';
import { approveCollectionControl } from '../../../controls/collection/collection.approve.control';
import { createCollectionControl } from '../../../controls/collection/collection.create.control';
import { rejectCollectionControl } from '../../../controls/collection/collection.reject.control';
import { updateCollectionControl } from '../../../controls/collection/collection.update.control';
import { CommonJoi, toJoiObject } from '../../../services/joi/common';
import { UidSchemaObject, onRequest } from '../common';
import { approveCollectionSchema } from './CollectionApproveRequestSchema';
import { createCollectionSchema } from './CollectionCreateRequestSchema';
import { mintCollectionSchema } from './CollectionMintRequestSchema';
import { rejectCollectionSchema } from './CollectionRejectRequestSchema';

export const createCollection = onRequest(WEN_FUNC.createCollection)(
  createCollectionSchema,
  createCollectionControl,
);

export const updateCollection = onRequest(WEN_FUNC.updateCollection)(
  toJoiObject<UidSchemaObject>({ uid: CommonJoi.uid() }),
  updateCollectionControl,
  true,
);

export const approveCollection = onRequest(WEN_FUNC.approveCollection)(
  approveCollectionSchema,
  approveCollectionControl,
);
export const rejectCollection = onRequest(WEN_FUNC.rejectCollection)(
  rejectCollectionSchema,
  rejectCollectionControl,
);

export const mintCollection = onRequest(WEN_FUNC.mintCollection, {
  memory: '8GiB',
  timeoutSeconds: 540,
})(mintCollectionSchema, mintCollectionOrderControl);
