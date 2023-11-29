import { IDocument, IQuery } from '@build-5/database';
import { Dataset, QUERY_MAX_LENGTH, Subset, TokenPurchase } from '@build-5/interfaces';
import Joi from 'joi';
import { head } from 'lodash';
import { Observable, map } from 'rxjs';

export const getQueryParams = <T>(url: string, schema: Joi.ObjectSchema): T => {
  const query = url.split('?')[1] || '';
  const joiResult = schema.validate(queryStrToParams(query));
  if (joiResult.error) {
    throw { code: 400, message: joiResult.error.details.map((d) => d.message)[0] || '' };
  }
  return <T>joiResult.value;
};

const queryStrToParams = (url: string) => {
  const strParams = new URLSearchParams(url);
  return [...strParams.entries()].reduce(
    (acc, [key, value]) => {
      const k = key.replace('[]', '');
      const v = key.endsWith('[]') ? [...(acc[k] || []), value] : value;
      return { ...acc, [k]: v };
    },
    {} as { [k: string]: any },
  );
};

export const isHiddenNft = (dataset: Dataset, data?: Record<string, unknown>) =>
  dataset === Dataset.NFT && data?.hidden === true;

export const queryToObservable = <T>(query: IQuery) =>
  new Observable<T[]>((observer) => {
    const unsubscribe = query.onSnapshot<T>(
      (data) => {
        observer.next(data);
      },
      (error) => {
        observer.error(error);
      },
    );
    return () => {
      unsubscribe();
    };
  });

export const documentToObservable = <T>(doc: IDocument) =>
  new Observable<T>((observer) => {
    const unsubscribe = doc.onSnapshot<T>(
      (data) => {
        observer.next(data);
      },
      (error) => {
        observer.error(error);
      },
    );
    return () => {
      unsubscribe();
    };
  });

export const getHeadPriceObs = (query: IQuery) =>
  queryToObservable<TokenPurchase>(query).pipe(map((r) => head(r)?.price || 0));

export const minAddressLength = 42;
export const maxAddressLength = 255;
export class CommonJoi {
  public static uid(required = true, minLength = minAddressLength): Joi.StringSchema<string> {
    const base = Joi.string().alphanum().min(minLength).max(maxAddressLength).lowercase();
    return required ? base.required() : base;
  }
}

export const getQueryLimit = (dataset: Dataset) => {
  switch (dataset) {
    case Dataset.AVATARS:
    case Dataset.BADGES:
      return 1;
    default:
      return QUERY_MAX_LENGTH;
  }
};

export const shouldSetProjectFilter = (dataset: Dataset, subset?: Subset): boolean =>
  ![
    Dataset.MILESTONE,
    Dataset.MEMBER,
    Dataset.PROJECT,
    Dataset.MILESTONE_RMS,
    Dataset.MILESTONE_SMR,
    Dataset.TICKER,
  ].includes(dataset) && !subset;
