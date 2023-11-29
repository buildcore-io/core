import { build5Db } from '@build-5/database';
import { Dataset, GetByIdRequest, Subset } from '@build-5/interfaces';
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
  dataset: Joi.string()
    .equal(...Object.values(Dataset))
    .required(),
  setId: Joi.string().alphanum().min(5).max(maxAddressLength).required(),
  subset: Joi.string()
    .equal(...Object.values(Subset))
    .optional(),
  subsetId: CommonJoi.uid(false, 7),
});

export const getById = async (url: string) => {
  const body = getQueryParams<GetByIdRequest>(url, getByIdSchema);

  const docPath =
    body.subset && body.subsetId
      ? `${body.dataset}/${body.setId}/${body.subset}/${body.subsetId}`
      : `${body.dataset}/${body.setId}`;
  const docRef = build5Db().doc(docPath);

  const observable = documentToObservable<Record<string, unknown>>(docRef).pipe(
    map((data) => {
      if (!data || isHiddenNft(body.dataset, data)) {
        return {};
      }
      return data;
    }),
  );
  return observable;
};
