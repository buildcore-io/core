import { ApiRoutes } from '@soonaverse/interfaces';

export enum SoonEnv {
  PROD = 'https://api.soonaverse.com/api',
  TEST = 'https://api-wen2.soonaverse.com/api',
  DEV = 'https://soonaverse-dev.web.app/api',
  LOCAL = 'http://127.0.0.1:5001/soonaverse-dev/us-central1/api',
}

export const getByIdUrl = (baseUrl: SoonEnv) => baseUrl + ApiRoutes.GET_BY_ID;

export const getByManyUrl = (baseUrl: SoonEnv) => baseUrl + ApiRoutes.GET_MANY;

export const getManyAdvancedUrl = (baseUrl: SoonEnv) => baseUrl + ApiRoutes.GET_MANY_ADVANCED;

export const getUpdatedAfterUrl = (baseUrl: SoonEnv) => baseUrl + ApiRoutes.GET_UPDATED_AFTER;

export const getTokenPriceUrl = (baseUrl: SoonEnv) => baseUrl + ApiRoutes.GET_TOKEN_PRICE;

export const getKeepAliveUrl = (baseUrl: SoonEnv) => baseUrl + ApiRoutes.KEEP_ALIVE;
