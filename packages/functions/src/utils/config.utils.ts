import {
  Bucket,
  COL,
  CUSTOM_TOKEN_MAX_LIFETIME,
  Network,
  PROD_NETWORKS,
  RANKING,
  RANKING_TEST,
  STAMP_ROYALTY_ADDRESS,
  TEST_NETWORKS,
  TOKEN_SALE,
  TOKEN_SALE_TEST,
  WEN_FUNC,
  WenError,
} from '@build-5/interfaces';
import { isEmpty } from 'lodash';
import { invalidArgument } from './error.utils';

export const isProdEnv = () => process.env.ENVIRONMENT === 'prod';
export const isTestEnv = () => process.env.ENVIRONMENT === 'test';
export const isEmulatorEnv = () => !['prod', 'test'].includes(process.env.ENVIRONMENT!);

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
      throw invalidArgument(WenError.invalid_params);
  }
};

export const getRankingThreshold = () => RANK_CONFIG.RANK_THRESHOLD;

export const getNftStorageToken = () => process.env.NFT_STORAGE_TOKEN!;

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

export const getStampRoyaltyAddress = (network: Network) => STAMP_ROYALTY_ADDRESS[network];

export const getDefaultNetwork = () => (isProdEnv() ? Network.IOTA : Network.ATOI);
