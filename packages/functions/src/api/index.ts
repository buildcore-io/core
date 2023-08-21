import { API_TIMEOUT_SECONDS, ApiRoutes, WEN_FUNC, WenError } from '@build-5/interfaces';
import cors from 'cors';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import { onRequestConfig } from '../firebase/functions/onRequest';
import { getAddresses } from './getAddresses';
import { getAvgPrice } from './getAvgPrice';
import { getById } from './getById';
import { getMany } from './getMany';
import { getManyAdvanced } from './getManyAdvanced';
import { getManyById } from './getManyById';
import { getPriceChange } from './getPriceChange';
import { getTokenPrice } from './getTokenPrice';
import { getTopMilestones } from './getTopMilestones';
import { getUpdatedAfter } from './getUpdatedAfter';
import { keepAlive } from './keepAlive';

export const api = functions.https.onRequest(
  onRequestConfig(WEN_FUNC.api, {
    timeoutSeconds: API_TIMEOUT_SECONDS,
    minInstances: 3,
    maxInstances: 100,
    memory: '1GiB',
    // This is to balance memory usage.
    concurrency: 250,
  }),
  (req, res) =>
    cors({ origin: true })(req, res, async () => {
      try {
        await getHandler(req.url)(req, res);
      } catch (error) {
        functions.logger.error('API error', error);
        res.status(400).send({ message: WenError.api_error.key });
      }
    }),
);

const getHandler = (url: string) => {
  const route = url.replace('/api', '').split('?')[0];
  switch (route) {
    case ApiRoutes.GET_BY_ID:
      return getById;
    case ApiRoutes.GET_MANY_BY_ID:
      return getManyById;
    case ApiRoutes.GET_MANY:
      return getMany;
    case ApiRoutes.GET_MANY_ADVANCED:
      return getManyAdvanced;
    case ApiRoutes.GET_UPDATED_AFTER:
      return getUpdatedAfter;
    case ApiRoutes.GET_TOKEN_PRICE:
      return getTokenPrice;
    case ApiRoutes.GET_AVG_PRICE:
      return getAvgPrice;
    case ApiRoutes.GET_PRICE_CHANGE:
      return getPriceChange;
    case ApiRoutes.GET_ADDRESSES:
      return getAddresses;
    case ApiRoutes.GET_TOP_MILESTONES:
      return getTopMilestones;
    case ApiRoutes.KEEP_ALIVE:
      return keepAlive;
    default:
      return invalidRoute;
  }
};

const invalidRoute = async (_: functions.https.Request, res: express.Response) => {
  res.sendStatus(404);
};
