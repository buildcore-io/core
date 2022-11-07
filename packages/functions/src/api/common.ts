import { PublicCollections, QUERY_MAX_LENGTH } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin from '../admin.config';

export const getQueryLimit = (collection: PublicCollections) => {
  switch (collection) {
    case PublicCollections.AVATARS:
    case PublicCollections.BADGES:
      return 1;
    default:
      return QUERY_MAX_LENGTH;
  }
};

export const isHiddenNft = (
  collection: PublicCollections,
  data: admin.firestore.DocumentData | undefined,
) => collection === PublicCollections.NFT && data?.hidden === true;

export const getQueryParams = <T>(
  req: functions.https.Request,
  res: functions.Response,
  schema: Joi.ObjectSchema,
): T | undefined => {
  const joiResult = schema.validate(req.query, { convert: true });
  if (joiResult.error) {
    res.status(400);
    res.send(joiResult.error.details.map((d) => d.message));
    return undefined;
  }
  return <T>joiResult.value;
};