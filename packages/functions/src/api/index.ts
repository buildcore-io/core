import { ApiRoutes, WEN_FUNC } from '@soonaverse/interfaces';
import cors from 'cors';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import { onRequestConfig } from '../firebase/functions/onRequest';
import { getAddresses } from './getAddresses';
import { getById } from './getById';
import { getMany } from './getMany';
import { getTokenPrice } from './getTokenPrice';
import { getUpdatedAfter } from './getUpdatedAfter';
import { keepAlive } from './keepAlive';

export const api = functions.https.onRequest(
  onRequestConfig(WEN_FUNC.api, { timeoutSeconds: 1800 }),
  (req, res) =>
    cors({ origin: true })(req, res, async () => {
      getHandler(req.url)(req, res);
    }),
);

const getHandler = (url: string) => {
  const route = url.replace('/api', '').split('?')[0];
  switch (route) {
    case ApiRoutes.GET_BY_ID:
      return getById;
    case ApiRoutes.GET_MANY:
      return getMany;
    case ApiRoutes.GET_UPDATED_AFTER:
      return getUpdatedAfter;
    case ApiRoutes.GET_TOKEN_PRICE:
      return getTokenPrice;
    case ApiRoutes.GET_ADDRESSES:
      return getAddresses;
    case ApiRoutes.KEEP_ALIVE:
      return keepAlive;
    default:
      return invalidRoute;
  }
};

const invalidRoute = async (_: functions.https.Request, res: express.Response) => {
  res.sendStatus(404);
};
