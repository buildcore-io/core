import { ApiRoutes } from '@build-5/interfaces';

export enum Build5Env {
  PROD = 'https://api.build5.com/api',
  TEST = 'https://api-test.build5.com/api',
  LOCAL = 'http://127.0.0.1:5001/soonaverse-dev/us-central1/api',
}

export const TOKENS: { [key: string]: string } = {
  [Build5Env.PROD]:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIweDU1MWZkMmM3YzdiZjM1NmJhYzE5NDU4N2RhYjJmY2Q0NjQyMDA1NGIiLCJwcm9qZWN0IjoiMHg0NjIyM2VkZDQxNTc2MzVkZmM2Mzk5MTU1NjA5ZjMwMWRlY2JmZDg4IiwiaWF0IjoxNzAwMDAyODkwfQ.IYZvBRuCiN0uYORKnVJ0SzT_1H_2o5xyDBG20VmnTQ0',
  [Build5Env.TEST]:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIweDU1MWZkMmM3YzdiZjM1NmJhYzE5NDU4N2RhYjJmY2Q0NjQyMDA1NGIiLCJwcm9qZWN0IjoiMHg0NjIyM2VkZDQxNTc2MzVkZmM2Mzk5MTU1NjA5ZjMwMWRlY2JmZDg4IiwiaWF0IjoxNjk1ODUyNTk2fQ.WT9L4H9eDdFfJZMrfxTKhEq4PojNWSGNv_CbmlG9sJg',
};

export const getByIdUrl = (baseUrl: Build5Env) => baseUrl + ApiRoutes.GET_BY_ID;

export const getManyByIdUrl = (baseUrl: Build5Env) => baseUrl + ApiRoutes.GET_MANY_BY_ID;

export const getManyUrl = (baseUrl: Build5Env) => baseUrl + ApiRoutes.GET_MANY;

export const getManyAdvancedUrl = (baseUrl: Build5Env) => baseUrl + ApiRoutes.GET_MANY_ADVANCED;

export const getUpdatedAfterUrl = (baseUrl: Build5Env) => baseUrl + ApiRoutes.GET_UPDATED_AFTER;

export const getTokenPriceUrl = (baseUrl: Build5Env) => baseUrl + ApiRoutes.GET_TOKEN_PRICE;

export const getAvgPriceUrl = (baseUrl: Build5Env) => baseUrl + ApiRoutes.GET_AVG_PRICE;

export const getPriceChangeUrl = (baseUrl: Build5Env) => baseUrl + ApiRoutes.GET_PRICE_CHANGE;

export const getTopMilestonesUrl = (baseUrl: Build5Env) => baseUrl + ApiRoutes.GET_TOP_MILESTONES;

export const getKeepAliveUrl = (baseUrl: Build5Env) => baseUrl + ApiRoutes.KEEP_ALIVE;
