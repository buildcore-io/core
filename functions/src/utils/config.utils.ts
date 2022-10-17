import * as functions from 'firebase-functions';
import { isEmpty } from 'lodash';
import { PROD_NETWORKS, TEST_NETWORKS, TOKEN_SALE, TOKEN_SALE_TEST } from '../../interfaces/config';

export const isProdEnv = () => functions.config()?.environment?.type === 'prod';
const tokenSale = isProdEnv() ? TOKEN_SALE : TOKEN_SALE_TEST;

export const isEmulatorEnv = functions.config()?.environment?.type === 'emulator';

export const getRoyaltyPercentage = () => Number(tokenSale?.percentage);

export const getSpaceOneRoyaltyPercentage = () => Number(tokenSale?.spaceonepercentage);

export const getRoyaltySpaces = (): string[] =>
  [tokenSale?.spaceone, tokenSale?.spacetwo].filter((space) => !isEmpty(space));

export const networks = isProdEnv() ? PROD_NETWORKS : [...PROD_NETWORKS, ...TEST_NETWORKS];

export const getStakeTokenId = () => functions.config()?.stake?.tokenId;
