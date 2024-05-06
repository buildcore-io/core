import { BaseRecord, IDocument, Update, database } from '@buildcore/database';
import {
  COL,
  Dataset,
  GetManyByIdRequest,
  QUERY_MAX_LENGTH,
  SUB_COL,
  Subset,
} from '@buildcore/interfaces';
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
  dataset: Joi.string()
    .equal(...Object.values(Dataset))
    .required(),
  setIds: Joi.array().items(CommonJoi.uid(false, 5)).max(QUERY_MAX_LENGTH).required(),
  subset: Joi.string()
    .equal(...Object.values(Subset))
    .optional(),
  subsetIds: Joi.array().items(uidSchema).min(1).max(QUERY_MAX_LENGTH).optional(),
});

export const getManyById = async (url: string, isLive: boolean) => {
  const body = getQueryParams<GetManyByIdRequest>(url, getManyByIdSchema);

  const observables = getQueries(body).map((b) => documentToObservable(b, isLive));
  return combineLatest(observables).pipe(
    map((all) => all.flat().filter((record) => record && !isHiddenNft(body.dataset, record))),
  );
};

const getQueries = (body: GetManyByIdRequest) =>
  body.setIds.map((setId, i) => {
    if (body.subset && body.subsetIds?.[i]) {
      return database().doc(
        body.dataset as unknown as COL,
        setId,
        body.subset as unknown as SUB_COL,
        body.subsetIds[i],
      )! as unknown as IDocument<any, BaseRecord, Update>;
    }
    return database().doc(body.dataset as unknown as COL, setId)! as IDocument<
      any,
      BaseRecord,
      Update
    >;
  });
