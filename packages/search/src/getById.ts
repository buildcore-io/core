import { BaseRecord, IDocument, Update, build5Db } from '@build-5/database';
import { COL, Dataset, GetByIdRequest, SUB_COL, Subset } from '@build-5/interfaces';
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

export const getById = async (url: string, isLive: boolean) => {
  const body = getQueryParams<GetByIdRequest>(url, getByIdSchema);

  const docRef = build5Db().doc(
    body.dataset as unknown as COL,
    body.setId,
    body.subset as unknown as SUB_COL,
    body.subsetId,
  )! as unknown as IDocument<any, BaseRecord, Update>;

  const observable = documentToObservable(docRef, isLive).pipe(
    map((data) => {
      if (!data || isHiddenNft(body.dataset, data)) {
        return {};
      }
      return data;
    }),
  );
  return observable;
};
