import { ApiRoutes, PING_INTERVAL } from '@build-5/interfaces';
import { wrappedFetch } from './fetch.utils';
import { randomString } from './utils';

export enum Build5Env {
  PROD = 'https://api.soonaverse.com/api',
  TEST = 'https://api-wen.build5.com/api',
  DEV = 'https://soonaverse-dev.web.app/api',
  LOCAL = 'http://127.0.0.1:5001/soonaverse-dev/us-central1/api',
}

export const getByIdUrl = (baseUrl: Build5Env) => baseUrl + ApiRoutes.GET_BY_ID;

export const getManyUrl = (baseUrl: Build5Env) => baseUrl + ApiRoutes.GET_MANY;

export const getManyAdvancedUrl = (baseUrl: Build5Env) => baseUrl + ApiRoutes.GET_MANY_ADVANCED;

export const getUpdatedAfterUrl = (baseUrl: Build5Env) => baseUrl + ApiRoutes.GET_UPDATED_AFTER;

export const getTokenPriceUrl = (baseUrl: Build5Env) => baseUrl + ApiRoutes.GET_TOKEN_PRICE;

export const getAvgPriceUrl = (baseUrl: Build5Env) => baseUrl + ApiRoutes.GET_AVG_PRICE;

export const getPriceChangeUrl = (baseUrl: Build5Env) => baseUrl + ApiRoutes.GET_PRICE_CHANGE;

export const getKeepAliveUrl = (baseUrl: Build5Env) => baseUrl + ApiRoutes.KEEP_ALIVE;

export const SESSION_ID = randomString();

export const initBuild5Env = (env: Build5Env) => {
  setInterval(async () => {
    const url = getKeepAliveUrl(env);
    await wrappedFetch(url, { sessionId: SESSION_ID });
  }, PING_INTERVAL * 0.8);
};
