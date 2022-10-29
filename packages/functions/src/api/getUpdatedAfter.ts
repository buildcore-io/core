import { GetUpdatedAfterRequest, MAX_FIELD_NAME_LENGTH, MAX_FIELD_VALUE_LENGTH, PublicCollections, PublicSubCollections } from '@soon/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { isEmpty } from 'lodash';
import admin from '../admin.config';
import { CommonJoi } from '../services/joi/common';
import { dateToTimestamp } from '../utils/dateTime.utils';
import { getQueryLimit, getQueryParams } from './common';

const getUpdatedAfterSchema = Joi.object({
  collection: Joi.string()
    .equal(...Object.values(PublicCollections))
    .required(),
  uid: CommonJoi.uid(false),
  subCollection: Joi.string()
    .equal(...Object.values(PublicSubCollections))
    .optional(),
  fieldName: Joi.string().alphanum().max(MAX_FIELD_NAME_LENGTH).optional(),
  fieldValue: [
    Joi.string().alphanum().max(MAX_FIELD_VALUE_LENGTH).optional(),
    Joi.number().optional(),
    Joi.boolean().optional(),
    Joi.date().optional(),
  ],
  updatedAfter: Joi.date().optional(),
});

export const getUpdatedAfter = async (req: functions.https.Request, res: functions.Response) => {
  const body = getQueryParams<GetUpdatedAfterRequest>(req, res, getUpdatedAfterSchema);
  if (!body) {
    return;
  }

  const baseCollectionPath =
    body.subCollection && body.uid
      ? `${body.collection}/${body.uid}/${body.subCollection}`
      : body.collection;

  const updatedAfter = body.updatedAfter ? dayjs(body.updatedAfter) : dayjs().subtract(1, 'h');
  const startAtSnap = await admin
    .firestore()
    .collection(baseCollectionPath)
    .where('updatedOn', '>=', dateToTimestamp(updatedAfter.toDate()))
    .orderBy('updatedOn')
    .limit(1)
    .get();

  let query = admin
    .firestore()
    .collection(baseCollectionPath)
    .orderBy('updatedOn')
    .limit(getQueryLimit(body.collection));

  if (body.fieldName && body.fieldValue) {
    query = query.where(body.fieldName, '==', body.fieldValue);
  }

  if (body.collection === PublicCollections.NFT) {
    query = query.where('hidden', '==', false);
  }

  if (body.collection === PublicCollections.TRANSACTION) {
    query = query.where('isOrderType', '==', false);
  }

  if (!startAtSnap.size) {
    res.send([]);
    return;
  }

  query = query.startAt(startAtSnap.docs[0]);

  const snap = await query.get();
  const result = snap.docs
    .map((d) => d.data())
    .filter((d) => !isEmpty(d))
    .map((d) => ({ id: d.uid, ...d }));
  res.send(result);
};
