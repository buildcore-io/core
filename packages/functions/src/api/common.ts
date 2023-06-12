import { PublicCollections, QUERY_MAX_LENGTH, TokenPurchase } from '@build-5/interfaces';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { head } from 'lodash';
import { Observable, map } from 'rxjs';
import { IDocument, IQuery } from '../firebase/firestore/interfaces';

export const getQueryLimit = (collection: PublicCollections) => {
  switch (collection) {
    case PublicCollections.AVATARS:
    case PublicCollections.BADGES:
      return 1;
    default:
      return QUERY_MAX_LENGTH;
  }
};

export const isHiddenNft = (collection: PublicCollections, data?: Record<string, unknown>) =>
  collection === PublicCollections.NFT && data?.hidden === true;

export const getQueryParams = <T>(
  req: functions.https.Request,
  res: express.Response,
  schema: Joi.ObjectSchema,
): T | undefined => {
  const joiResult = schema.validate(req.query);
  if (joiResult.error) {
    res.status(400);
    res.send(joiResult.error.details.map((d) => d.message));
    return undefined;
  }
  return <T>joiResult.value;
};

export const queryToObservable = <T>(query: IQuery) =>
  new Observable<T[]>((observer) => {
    const unsubscribe = query.onSnapshot<T>((data) => {
      observer.next(data);
    });
    return () => {
      unsubscribe();
    };
  });

export const documentToObservable = <T>(doc: IDocument) =>
  new Observable<T>((observer) => {
    const unsubscribe = doc.onSnapshot<T>((data) => {
      observer.next(data);
    });
    return () => {
      unsubscribe();
    };
  });

export const getHeadCountObs = (query: IQuery) =>
  queryToObservable<TokenPurchase>(query).pipe(map((r) => head(r)?.count || 0));
