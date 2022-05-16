
import { WenError } from '../../interfaces/errors';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenStatus } from "../../interfaces/models/token";
import admin from '../admin.config';
import { throwInvalidArgument } from './error.utils';

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

export const assertIsTokenPreMinted = async (tokenId: string) => {
  const token = <Token | undefined>(await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).get()).data()
  if (token?.status !== TokenStatus.PRE_MINTED) {
    throw throwInvalidArgument(WenError.token_not_pre_minted)
  }
}
