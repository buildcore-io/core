import {
  Bucket,
  COL,
  CUSTOM_TOKEN_MAX_LIFETIME,
  PROD_NETWORKS,
  RANKING,
  RANKING_TEST,
  TEST_NETWORKS,
  TOKEN_SALE,
  TOKEN_SALE_TEST,
  WenError,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { isEmpty } from 'lodash';
import { throwInvalidArgument } from './error.utils';

export const isProdEnv = () => functions.config()?.environment?.type === 'prod';
export const getTokenSaleConfig = isProdEnv() ? TOKEN_SALE : TOKEN_SALE_TEST;

export const isEmulatorEnv = functions.config()?.environment?.type === 'emulator';

export const getRoyaltyPercentage = () => Number(getTokenSaleConfig?.percentage);

export const getSpaceOneRoyaltyPercentage = () => Number(getTokenSaleConfig?.spaceonepercentage);

export const getRoyaltySpaces = (): string[] =>
  [getTokenSaleConfig?.spaceone, getTokenSaleConfig?.spacetwo].filter((space) => !isEmpty(space));

export const networks = isProdEnv() ? PROD_NETWORKS : [...PROD_NETWORKS, ...TEST_NETWORKS];

export const RANK_CONFIG = isProdEnv() ? RANKING : RANKING_TEST;

export const getRankingSpace = (col: COL) => {
  switch (col) {
    case COL.TOKEN:
      return RANK_CONFIG.tokenSpace;
    case COL.COLLECTION:
      return RANK_CONFIG.collectionSpace;
    default:
      throw throwInvalidArgument(WenError.invalid_params);
  }
};

export const getRankingThreshold = () => RANK_CONFIG.RANK_THRESHOLD;

export const getWeb3Token = () => functions.config().web3.token;

export const getBucket = () => {
  if (isProdEnv()) {
    return Bucket.PROD;
  }
  if (isEmulatorEnv) {
    return Bucket.DEV;
  }
  return Bucket.TEST;
};

export const getJwtSecretKey = functions.config().jwt.secret;

export const getCustomTokenLifetime = (func: WEN_FUNC) => CUSTOM_TOKEN_MAX_LIFETIME[func];
