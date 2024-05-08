import { BaseRecord, ICollection, IDocument, Update, database } from '@buildcore/database';
import {
  COL,
  Dataset,
  GetUpdatedAfterRequest,
  MAX_MILLISECONDS,
  SUB_COL,
  Subset,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { isEmpty } from 'lodash';
import { map } from 'rxjs';
import {
  CommonJoi,
  getQueryLimit,
  getQueryParams,
  queryToObservable,
  shouldSetProjectFilter,
} from './common';

const getUpdatedAfterSchema = Joi.object({
  dataset: Joi.string()
    .equal(...Object.values(Dataset))
    .required(),
  setId: CommonJoi.uid(false, 5),
  subset: Joi.string()
    .equal(...Object.values(Subset))
    .optional(),
  updatedAfter: Joi.number().min(0).max(MAX_MILLISECONDS).integer().optional(),
  startAfter: CommonJoi.uid(false),
});

export const getUpdatedAfter = async (project: string, url: string, isLive: boolean) => {
  const body = getQueryParams<GetUpdatedAfterRequest>(url, getUpdatedAfterSchema);

  const updatedAfter = body.updatedAfter ? dayjs(body.updatedAfter) : dayjs().subtract(1, 'h');
  const collection = database().collection(
    body.dataset as unknown as COL,
    body.setId,
    body.subset as unknown as SUB_COL,
  )! as unknown as ICollection<any, BaseRecord, Update>;
  let query = collection
    .where('updatedOn', '>=', updatedAfter.toDate())
    .orderBy('updatedOn')
    .limit(getQueryLimit(body.dataset));

  if (body.dataset === Dataset.NFT) {
    query = query.where('hidden' as any, '==', false);
  }

  if (body.dataset === Dataset.TRANSACTION) {
    query = query.where('isOrderType' as any, '==', false);
  }

  if (shouldSetProjectFilter(body.dataset, body.subset)) {
    query = query.where('project', '==', project);
  }

  if (body.startAfter) {
    const docRef = database().doc(
      body.dataset as unknown as COL,
      body.setId || body.startAfter,
      body.subset as unknown as SUB_COL,
      body.startAfter,
    )! as unknown as IDocument<any, BaseRecord, Update>;
    const startAfter = await docRef.get();
    if (startAfter) {
      query = query.startAfter(startAfter);
    }
  }

  return queryToObservable<Record<string, unknown>>(query, isLive).pipe(
    map((snap) => snap.filter((d) => !isEmpty(d)).map((d) => ({ id: d.uid, ...d }))),
  );
};
