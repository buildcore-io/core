
import { WenError } from '../../interfaces/errors';
import { Space, TransactionType } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenAccess, TokenStatus } from "../../interfaces/models/token";
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

export const assertIsTokenPreMintedAndApproved = async (tokenId: string) => {
  const token = <Token | undefined>(await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).get()).data()
  if (token?.status !== TokenStatus.PRE_MINTED) {
    throw throwInvalidArgument(WenError.token_not_pre_minted)
  }
  if (!token?.approved) {
    throw throwInvalidArgument(WenError.token_not_approved)
  }
}

const isMember = async (space: Space, member: string) => (await admin.firestore().doc(`${COL.SPACE}/${space.uid}/${SUB_COL.MEMBERS}/${member}`).get()).exists

const isGuardian = async (space: Space, member: string) => (await admin.firestore().doc(`${COL.SPACE}/${space.uid}/${SUB_COL.GUARDIANS}/${member}`).get()).exists

export const canAccessToken = async (space: Space, token: Token, member: string) => {
  if (token.access === TokenAccess.OPEN) {
    return true;
  }

  if (token.access === TokenAccess.MEMBERS_ONLY) {
    return await isMember(space, member)
  }

  if (token.access === TokenAccess.GUARDIANS_ONLY) {
    return await isGuardian(space, member)
  }

  if (token.access === TokenAccess.MEMBERS_WITH_BADGE) {
    if (!(await isMember(space, member))) {
      return false
    }
    const snapshot = await admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BADGE)
      .where('member', '==', member)
      .limit(1)
      .get()
    return !snapshot.empty;
  }

  if (token.access === TokenAccess.MEMBERS_WITH_NFT_FROM_SPACE) {
    if (!(await isMember(space, member))) {
      return false
    }
    const snapshot = await admin.firestore().collection(COL.NFT)
      .where('owner', '==', member)
      .where('space', '==', space.uid)
      .limit(1)
      .get()
    return !snapshot.empty;
  }

  return true
}
