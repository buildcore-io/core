import { BaseRecord, IDocument, IQuery, PgTokenPurchase, Update } from '@buildcore/database';
import { Dataset, QUERY_MAX_LENGTH, Subset, TokenPurchase } from '@buildcore/interfaces';
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

export const isHiddenNft = (dataset: Dataset, data?: any) =>
  dataset === Dataset.NFT && data?.hidden === true;

export const queryToObservable = <C>(query: IQuery<C, BaseRecord>, isLive: boolean) => {
  if (isLive) {
    return new Observable<C[]>((obs) => {
      const unsubscribe = query.onSnapshot(
        (data) => {
          obs.next(data);
        },
        (error) => {
          obs.error(error);
        },
      );
      return () => {
        unsubscribe();
      };
    });
  }

  return new Observable<C[]>((obs) => {
    query
      .get()
      .then((r) => obs.next(r))
      .catch((err) => obs.error(err));
  });
};

export const documentToObservable = <C, B extends BaseRecord, U extends Update>(
  doc: IDocument<C, B, U>,
  isLive: boolean,
): Observable<C> => {
  if (isLive) {
    return new Observable<C>((observer) => {
      const unsubscribe = doc.onSnapshot(
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
  }

  return new Observable<C>((obs) => {
    doc
      .get()
      .then((r) => obs.next(r))
      .catch((err) => obs.error(err));
  });
};

export const getHeadPriceObs = (query: IQuery<TokenPurchase, PgTokenPurchase>, isLive: boolean) =>
  queryToObservable(query, isLive).pipe(map((r) => head(r)?.price || 0));

// Used to be 42, changed to 5 to support milestone get and transactions subset
export const minAddressLength = 5;
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

export const keyToPg = (key: string) => {
  return key.replace(/\./g, '_') as any;
};
