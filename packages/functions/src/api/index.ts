import { ApiRoutes, WenError } from '@soon/interfaces';
import cors from 'cors';
import * as functions from 'firebase-functions';
import { throwInvalidArgument } from '../utils/error.utils';
import { getById } from './getById';
import { getMany } from './getMany';
import { getTokenPrice } from './getTokenPrice';
import { getUpdatedAfter } from './getUpdatedAfter';

export const api = functions
  .runWith({ allowInvalidAppCheckToken: true })
  .https.onRequest((req, res) =>
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
    default:
      functions.logger.error(WenError.invalid_route.key, url, route);
      throw throwInvalidArgument(WenError.invalid_route);
  }
};
