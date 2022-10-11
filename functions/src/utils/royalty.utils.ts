import bigDecimal from 'js-big-decimal';
import { COL } from '../../interfaces/models/base';
import { SystemConfig, SYSTEM_CONFIG_DOC_ID } from '../../interfaces/models/system.config';
import admin from '../admin.config';
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
  const systemConfig = <SystemConfig | undefined>(
    (await admin.firestore().doc(`${COL.SYSTEM}/${SYSTEM_CONFIG_DOC_ID}`).get()).data()
  );
  const systemPercentage = isTokenPurchase
    ? systemConfig?.tokenPurchaseFeePercentage
    : systemConfig?.tokenTradingFeePercentage;
  if (systemPercentage !== undefined) {
    return systemPercentage;
  }
  return getRoyaltyPercentage();
};
