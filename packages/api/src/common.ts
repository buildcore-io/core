import { IDocument, IQuery } from '@build-5/database';
import {
  PublicCollections,
  PublicSubCollections,
  QUERY_MAX_LENGTH,
  TokenPurchase,
} from '@build-5/interfaces';
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

export const isHiddenNft = (collection: PublicCollections, data?: Record<string, unknown>) =>
  collection === PublicCollections.NFT && data?.hidden === true;

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
  public static uid(required = true): Joi.StringSchema<string> {
    const base = Joi.string().alphanum().min(minAddressLength).max(maxAddressLength).lowercase();
    return required ? base.required() : base;
  }
}

export const getQueryLimit = (collection: PublicCollections) => {
  switch (collection) {
    case PublicCollections.AVATARS:
    case PublicCollections.BADGES:
      return 1;
    default:
      return QUERY_MAX_LENGTH;
  }
};

export const shouldSetProjectFilter = (
  col: PublicCollections,
  subCol?: PublicSubCollections,
): boolean =>
  ![
    PublicCollections.MILESTONE,
    PublicCollections.MEMBER,
    PublicCollections.PROJECT,
    PublicCollections.MILESTONE_RMS,
    PublicCollections.MILESTONE_SMR,
    PublicCollections.TICKER,
  ].includes(col) && !subCol;
