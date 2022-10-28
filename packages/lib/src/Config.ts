import { ApiRoutes } from '@soon/interfaces';

export enum SoonEnv {
  DEV = 'https://soonaverse-dev.web.app/api',
  TEST = 'https://wen2.soonaverse.com/api',
  PROD = 'https://soonaverse.com/api',
}

export const getByIdUrl = (baseUrl: SoonEnv) => baseUrl + ApiRoutes.GET_BY_ID;

export const getByManyUrl = (baseUrl: SoonEnv) => baseUrl + ApiRoutes.GET_MANY;

export const getUpdatedAfterUrl = (baseUrl: SoonEnv) => baseUrl + ApiRoutes.GET_UPDATED_AFTER;

export const getTokenPriceUrl = (baseUrl: SoonEnv) => baseUrl + ApiRoutes.GET_TOKEN_PRICE;
