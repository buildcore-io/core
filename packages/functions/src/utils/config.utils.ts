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
import { isEmpty } from 'lodash';
import { throwInvalidArgument } from './error.utils';

export const isProdEnv = () => process.env.ENVIRONMENT === 'prod';
export const isTestEnv = () => process.env.ENVIRONMENT === 'test';
export const isEmulatorEnv = () => process.env.ENVIRONMENT === 'emulator';
export const isProdOrTestEnv = () => isProdEnv() || isTestEnv();

export const getTokenSaleConfig = isProdEnv() ? TOKEN_SALE : TOKEN_SALE_TEST;

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

export const getWeb3Token = () => process.env.WEB3_TOKEN!;

export const getBucket = () => {
  if (isProdEnv()) {
    return Bucket.PROD;
  }
  if (isTestEnv()) {
    return Bucket.TEST;
  }
  return Bucket.DEV;
};

export const getJwtSecretKey = () => process.env.JWT_SECRET!;

export const getCustomTokenLifetime = (func: WEN_FUNC) => CUSTOM_TOKEN_MAX_LIFETIME[func];

export const algoliaAppId = () => process.env.ALGOLIA_APPID!;
export const algoliaKey = () => process.env.ALGOLIA_KEY!;

export const xpTokenId = () => process.env.XPTOKEN_ID!;
export const xpTokenUid = () => process.env.XPTOKEN_UID!;
export const xpTokenGuardianId = () => process.env.XPTOKEN_GUARDIANID!;
