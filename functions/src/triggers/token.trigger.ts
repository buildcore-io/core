import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { MIN_IOTA_AMOUNT } from '../../interfaces/config';
import { Member, Space, Transaction, TransactionType } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenPurchase, TokenStatus } from '../../interfaces/models/token';
import { serverTime } from '../utils/dateTime.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

const getTokenCount = (token: Token, amount: number) => Math.floor(amount / token.pricePerToken)

const getTokenOwned = (totalSupply: number, totalBought: number, payedByMember: number) =>
  totalSupply >= totalBought ? payedByMember : Math.floor(payedByMember * 100 / totalBought / 100 * totalSupply)

const getMemberPurchaseAllocation = (purchase: TokenPurchase, token: Token, totalSupply: number, totalBought: number): TokenPurchase => {
  const totalDeposit = purchase.totalDeposit || 0;
  const payedByMember = getTokenCount(token, totalDeposit)
  const tokenOwned = getTokenOwned(totalSupply, totalBought, payedByMember)
  const amount = token.pricePerToken * tokenOwned
  if (totalSupply >= totalBought) {
    return { ...purchase, amount, tokenOwned, refundedAmount: 0 }
  }
  const refundedAmount = totalDeposit - (tokenOwned * token.pricePerToken)
  return { ...purchase, amount, tokenOwned, refundedAmount: refundedAmount < MIN_IOTA_AMOUNT ? 0 : refundedAmount }
}

const createBillPayment = (token: Token, purchase: TokenPurchase, space: Space, batch: admin.firestore.WriteBatch) => {
  const tranId: string = getRandomEthAddress();
  const docRef = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
  const data = <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: tranId,
    space: token.space,
    member: purchase.member,
    createdOn: serverTime(),
    payload: {
      amount: purchase.amount,
      targetAddress: space.validatedAddress,
      reconciled: true,
      royalty: false,
      void: false,
    }
  };
  batch.create(docRef, data)
}

const createCredit = async (token: Token, purchase: TokenPurchase, batch: admin.firestore.WriteBatch) => {
  const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${purchase.member}`).get()).data()
  const tranId: string = getRandomEthAddress();
  const docRef = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
  const data = <Transaction>{
    type: TransactionType.CREDIT,
    uid: tranId,
    space: token.space,
    member: purchase.member,
    createdOn: serverTime(),
    payload: {
      amount: purchase.refundedAmount,
      targetAddress: member.validatedAddress,
      reconciled: true,
      void: false,
    }
  };
  batch.create(docRef, data)
}

const reconcileBuyer = (token: Token, space: Space) => async (purchase: TokenPurchase) => {
  const batch = admin.firestore().batch();
  const purchaseDoc = admin.firestore().doc(`${COL.TOKENS}/${token.uid}/${SUB_COL.PURCHASES}/${purchase.member}`)
  batch.update(purchaseDoc, { ...purchase, reconciled: true })

  createBillPayment(token, purchase, space, batch)
  purchase.refundedAmount && await createCredit(token, purchase, batch)
  await batch.commit()
}

export const onTokenStatusUpdate = functions.runWith({ timeoutSeconds: 540, memory: "512MB" })
  .firestore.document(COL.TOKENS + '/{tokenId}').onUpdate(async (change, context) => {
    const tokenId = context.params.tokenId
    const prev = change.before.data();
    const token = <Token | undefined>change.after.data();

    if (!token || token.status !== TokenStatus.PROCESSING_PAYMENTS || prev.status !== TokenStatus.READY) {
      return;
    }

    const purchasesSnap = await admin.firestore().collection(`${COL.TOKENS}/${tokenId}/${SUB_COL.PURCHASES}`).get()
    const totalBought = purchasesSnap.docs.reduce((sum, doc) => sum + getTokenCount(token, (<TokenPurchase>doc.data()!).totalDeposit || 0), 0)

    const publicPercentage = token.allocations.find(a => a.isPublicSale)?.percentage || 0
    const totalPublicSupply = Math.floor(token.totalSupply * (publicPercentage / 100))

    const space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${token.space}`).get()).data()

    const promises = purchasesSnap.docs
      .map(doc => getMemberPurchaseAllocation(<TokenPurchase>doc.data()!, token, totalPublicSupply, totalBought))
      .filter(p => !p.reconciled)
      .map(reconcileBuyer(token, space))

    await Promise.all(promises);

    await admin.firestore().doc(`${COL.TOKENS}/${tokenId}`).update({ status: TokenStatus.READY })
  })
