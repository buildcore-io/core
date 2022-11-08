import { PROD_NETWORKS, TEST_NETWORKS, TOKEN_SALE, TOKEN_SALE_TEST } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { isEmpty } from 'lodash';

export const isProdEnv = () => functions.config()?.environment?.type === 'prod';
export const getTokenSaleConfig = isProdEnv() ? TOKEN_SALE : TOKEN_SALE_TEST;

export const isEmulatorEnv = functions.config()?.environment?.type === 'emulator';

export const getRoyaltyPercentage = () => Number(getTokenSaleConfig?.percentage);

export const getSpaceOneRoyaltyPercentage = () => Number(getTokenSaleConfig?.spaceonepercentage);

export const getRoyaltySpaces = (): string[] =>
  [getTokenSaleConfig?.spaceone, getTokenSaleConfig?.spacetwo].filter((space) => !isEmpty(space));

export const networks = isProdEnv() ? PROD_NETWORKS : [...PROD_NETWORKS, ...TEST_NETWORKS];
