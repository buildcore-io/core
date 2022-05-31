
import bigDecimal from 'js-big-decimal';
import { WenError } from '../../interfaces/errors';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token } from "../../interfaces/models/token";
import admin from '../admin.config';
import { throwInvalidArgument } from './error.utils';

export const BIG_DECIMAL_PRECISION = 1000

export const tokenOrderTransactionDocId = (member: string, token: Token) => member + '_' + token.uid

export const allPaymentsQuery = (member: string, tokenId: string) =>
  admin.firestore().collection(COL.TRANSACTION)
    .where('member', '==', member)
    .where('payload.token', '==', tokenId)

export const orderDocRef = (member: string, token: Token) =>
  admin.firestore().doc(`${COL.TRANSACTION}/${tokenOrderTransactionDocId(member, token)}`)

export const memberDocRef = (member: string) => admin.firestore().doc(`${COL.MEMBER}/${member}`)

export const assertIsGuardian = async (space: string, member: string) => {
  const guardianDoc = (await admin.firestore().doc(`${COL.SPACE}/${space}/${SUB_COL.GUARDIANS}/${member}`).get());
  if (!guardianDoc.exists) {
    throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
  }
}

export const assertTokenApproved = (token: Token) => {
  if (!token.approved || token.rejected) {
    throw throwInvalidArgument(WenError.token_not_approved)
  }
}

export const getBoughtByMemberDiff = (prevTotalDeposit: number, currTotalDeposit: number, pricePerToken: number) => {
  const prevOrderCount = bigDecimal.floor(bigDecimal.divide(prevTotalDeposit, pricePerToken, BIG_DECIMAL_PRECISION))
  const currentOrderCount = bigDecimal.floor(bigDecimal.divide(currTotalDeposit, pricePerToken, BIG_DECIMAL_PRECISION))
  return Number(bigDecimal.subtract(currentOrderCount, prevOrderCount))
}

export const getTotalPublicSupply = (token: Token) => {
  const publicPercentage = token.allocations.find(a => a.isPublicSale)?.percentage || 0
  return Number(bigDecimal.floor(bigDecimal.multiply(token.totalSupply, publicPercentage / 100)))
}
