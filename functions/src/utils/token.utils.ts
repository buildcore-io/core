
import * as admin from 'firebase-admin';
import { COL } from '../../interfaces/models/base';
import { Token } from "../../interfaces/models/token";

export const tokenOrderTransactionDocId = (member: string, token: Token) => member + '_' + token.uid

export const allPaymentsQuery = (member: string, tokenId: string) =>
  admin.firestore().collection(COL.TRANSACTION)
    .where('member', '==', member)
    .where('payload.token', '==', tokenId)

export const orderDocRef = (member: string, token: Token) =>
  admin.firestore().doc(`${COL.TRANSACTION}/${tokenOrderTransactionDocId(member, token)}`)

export const memberDocRef = (member: string) => admin.firestore().doc(`${COL.MEMBER}/${member}`)
