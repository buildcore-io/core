import {
  GetUpdatedAfterRequest,
  MAX_MILLISECONDS,
  PublicCollections,
  PublicSubCollections,
} from '@soonaverse/interfaces';
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
  updatedAfter: Joi.number().min(0).max(MAX_MILLISECONDS).integer().optional(),
});

export const getUpdatedAfter = async (req: functions.https.Request, res: functions.Response) => {
  const body = getQueryParams<GetUpdatedAfterRequest>(req, res, getUpdatedAfterSchema);
  if (!body) {
    return;
  }

  const isSubCollectionQuery = body.subCollection && body.uid;
  const baseCollectionPath = isSubCollectionQuery
    ? `${body.collection}/${body.uid}/${body.subCollection}`
    : body.collection;

  const updatedAfter = body.updatedAfter ? dayjs(body.updatedAfter) : dayjs().subtract(1, 'h');
  if (!isSubCollectionQuery && body.uid) {
    // They want to just monitor one record.
    let query = admin.firestore().collection(baseCollectionPath).where('uid', '==', body.uid);

    if (body.collection === PublicCollections.NFT) {
      query = query.where('hidden', '==', false);
    }

    if (body.collection === PublicCollections.TRANSACTION) {
      query = query.where('isOrderType', '==', false);
    }

    query = query.limit(1);
    const snap = await query.get();
    const result = snap.docs
      .map((d) => d.data())
      .filter((d) => !isEmpty(d) && dayjs(d.updatedOn.toDate()).isAfter(updatedAfter))
      .map((d) => ({ id: d.uid, ...d }));
    res.send(result);
  } else {
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
  }
};
