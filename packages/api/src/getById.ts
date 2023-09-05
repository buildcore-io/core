import { build5Db } from '@build-5/database';
import { GetByIdRequest, PublicCollections, PublicSubCollections } from '@build-5/interfaces';
import Joi from 'joi';
import { map } from 'rxjs';
import {
  CommonJoi,
  documentToObservable,
  getQueryParams,
  isHiddenNft,
  maxAddressLength,
} from './common';

const getByIdSchema = Joi.object({
  collection: Joi.string()
    .equal(...Object.values(PublicCollections))
    .required(),
  parentUid: CommonJoi.uid(false),
  subCollection: Joi.string()
    .equal(...Object.values(PublicSubCollections))
    .optional(),
  uid: Joi.string().alphanum().min(5).max(maxAddressLength).required(),
});

export const getById = async (url: string) => {
  const body = getQueryParams<GetByIdRequest>(url, getByIdSchema);

  const docPath =
    body.parentUid && body.subCollection
      ? `${body.collection}/${body.parentUid}/${body.subCollection}/${body.uid}`
      : `${body.collection}/${body.uid}`;
  const docRef = build5Db().doc(docPath);

  const observable = documentToObservable<Record<string, unknown>>(docRef).pipe(
    map((data) => {
      if (!data || isHiddenNft(body.collection, data)) {
        return {};
      }
      return data;
    }),
  );
  return observable;
};
