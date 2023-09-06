import { build5Db } from '@build-5/database';
import {
  GetManyByIdRequest,
  PublicCollections,
  PublicSubCollections,
  QUERY_MAX_LENGTH,
} from '@build-5/interfaces';
import Joi from 'joi';
import { combineLatest, map } from 'rxjs';
import {
  CommonJoi,
  documentToObservable,
  getQueryParams,
  isHiddenNft,
  maxAddressLength,
} from './common';

const uidSchema = Joi.string().alphanum().min(5).max(maxAddressLength).required();

const getManyByIdSchema = Joi.object({
  collection: Joi.string()
    .equal(...Object.values(PublicCollections))
    .required(),
  parentUids: Joi.array().items(CommonJoi.uid(false)).max(QUERY_MAX_LENGTH),
  subCollection: Joi.string()
    .equal(...Object.values(PublicSubCollections))
    .optional(),
  uids: Joi.array().items(uidSchema).min(1).max(QUERY_MAX_LENGTH).required(),
});

export const getManyById = async (url: string) => {
  const body = getQueryParams<GetManyByIdRequest>(url, getManyByIdSchema);

  const observables = getQueries(body).map(documentToObservable<Record<string, unknown>>);
  return combineLatest(observables).pipe(
    map((all) => all.flat().filter((record) => record && !isHiddenNft(body.collection, record))),
  );
};

const getQueries = (body: GetManyByIdRequest) =>
  body.uids.map((uid, i) => {
    if (body.subCollection && body.parentUids?.[i]) {
      return build5Db()
        .collection(body.collection)
        .doc(body.parentUids?.[i])
        .collection(body.subCollection)
        .doc(uid);
    }
    return build5Db().doc(`${body.collection}/${uid}`);
  });
