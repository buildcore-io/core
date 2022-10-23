import {
  GetByIdRequest,
  PublicCollections,
  PublicSubCollections,
  QUERY_MAX_LENGTH,
  QUERY_MIN_LENGTH,
} from '@soon/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { isEmpty } from 'lodash';
import admin from '../admin.config';
import { CommonJoi } from '../services/joi/common';
import { assertValidation } from '../utils/schema.utils';
import { isNotHiddenNft } from './common';

const getByIdSchema = Joi.object({
  collection: Joi.string()
    .equal(...Object.values(PublicCollections))
    .required(),
  parentUid: CommonJoi.uid(false),
  subCollection: Joi.string()
    .equal(...Object.values(PublicSubCollections))
    .optional(),
  uids: Joi.array()
    .items(CommonJoi.uid())
    .min(QUERY_MIN_LENGTH)
    .max(QUERY_MAX_LENGTH)
    .required()
    .unique(),
});

export const getById = functions.https.onRequest(async (req, res) => {
  assertValidation(getByIdSchema.validate(req.body));
  const body = <GetByIdRequest>req.body;
  const baseCollection =
    body.parentUid && body.subCollection
      ? admin.firestore().collection(`${body.collection}/${body.parentUid}/${body.subCollection}`)
      : admin.firestore().collection(body.collection);
  const promises = body.uids.map((uid) => baseCollection.doc(uid).get());
  const docs = await Promise.all(promises);
  const result = docs
    .map((d) => d.data())
    .filter((d) => !isEmpty(d) && isNotHiddenNft(body.collection, d));
  res.send(result);
});
