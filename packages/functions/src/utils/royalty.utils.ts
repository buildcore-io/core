import { build5Db } from '@build-5/database';
import { COL, SYSTEM_CONFIG_DOC_ID, SystemConfig } from '@build-5/interfaces';
import bigDecimal from 'js-big-decimal';
import {
  getRoyaltyPercentage,
  getRoyaltySpaces,
  getSpaceOneRoyaltyPercentage,
} from './config.utils';

export const getRoyaltyFees = async (
  amount: number,
  memberPercentage: number | undefined,
  isTokenPurchase = false,
) => {
  const royaltySpaces = getRoyaltySpaces();
  const percentage = await getTokenPurchaseFeePercentage(memberPercentage, isTokenPurchase);

  if (isTokenPurchase) {
    const royaltiesSpaceOne = Number(
      bigDecimal.floor(bigDecimal.multiply(amount, percentage / 100)),
    );
    return { [royaltySpaces[0]]: royaltiesSpaceOne };
  }

  const spaceOnePercentage = getSpaceOneRoyaltyPercentage();
  const royaltyAmount = Number(bigDecimal.ceil(bigDecimal.multiply(amount, percentage / 100)));
  const royaltiesSpaceOne = Number(
    bigDecimal.ceil(bigDecimal.multiply(royaltyAmount, spaceOnePercentage / 100)),
  );
  const royaltiesSpaceTwo = Number(bigDecimal.subtract(royaltyAmount, royaltiesSpaceOne));
  return { [royaltySpaces[0]]: royaltiesSpaceOne, [royaltySpaces[1]]: royaltiesSpaceTwo };
};

const getTokenPurchaseFeePercentage = async (
  memberFeePercentage: number | undefined,
  isTokenPurchase = false,
) => {
  if (memberFeePercentage !== undefined) {
    return memberFeePercentage;
  }
  const systemConfig = await build5Db()
    .doc(`${COL.SYSTEM}/${SYSTEM_CONFIG_DOC_ID}`)
    .get<SystemConfig>();
  const systemPercentage = isTokenPurchase
    ? systemConfig?.tokenPurchaseFeePercentage
    : systemConfig?.tokenTradingFeePercentage;
  if (systemPercentage !== undefined) {
    return systemPercentage;
  }
  return getRoyaltyPercentage();
};
