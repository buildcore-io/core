import { HttpsWrapper } from './https';

export const https = (origin = Build5.PROD) => new HttpsWrapper(origin);

export enum Build5 {
  PROD = 'https://api.build5.com',
  TEST = 'https://api-test.build5.com',
  LOCAL = 'http://127.0.0.1:5001/soonaverse-dev/us-central1',
  API_LOCAL = 'http://localhost:8080',
}

export const API_KEY: { [key: string]: string } = {
  [Build5.PROD]:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIweDU1MWZkMmM3YzdiZjM1NmJhYzE5NDU4N2RhYjJmY2Q0NjQyMDA1NGIiLCJwcm9qZWN0IjoiMHg0NjIyM2VkZDQxNTc2MzVkZmM2Mzk5MTU1NjA5ZjMwMWRlY2JmZDg4IiwiaWF0IjoxNzAwMDAyODkwfQ.IYZvBRuCiN0uYORKnVJ0SzT_1H_2o5xyDBG20VmnTQ0',
  [Build5.TEST]:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIweDU1MWZkMmM3YzdiZjM1NmJhYzE5NDU4N2RhYjJmY2Q0NjQyMDA1NGIiLCJwcm9qZWN0IjoiMHg0NjIyM2VkZDQxNTc2MzVkZmM2Mzk5MTU1NjA5ZjMwMWRlY2JmZDg4IiwiaWF0IjoxNjk1ODUyNTk2fQ.WT9L4H9eDdFfJZMrfxTKhEq4PojNWSGNv_CbmlG9sJg',
  [Build5.LOCAL]:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwcm9qZWN0IjoiMHg0NjIyM2VkZDQxNTc2MzVkZmM2Mzk5MTU1NjA5ZjMwMWRlY2JmZDg4IiwiaWF0IjoxNjk5MjgyMTQxfQ.Bd0IZNdtc3ne--CC1Bk5qDgWl4NojAsX64K1rCj-5Co',
  [Build5.API_LOCAL]:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIweDU1MWZkMmM3YzdiZjM1NmJhYzE5NDU4N2RhYjJmY2Q0NjQyMDA1NGIiLCJwcm9qZWN0IjoiMHg0NjIyM2VkZDQxNTc2MzVkZmM2Mzk5MTU1NjA5ZjMwMWRlY2JmZDg4IiwiaWF0IjoxNjk1ODUyNTk2fQ.WT9L4H9eDdFfJZMrfxTKhEq4PojNWSGNv_CbmlG9sJg',
};
