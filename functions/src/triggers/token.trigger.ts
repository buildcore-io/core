import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { MIN_IOTA_AMOUNT } from '../../interfaces/config';
import { Member, Space, Transaction, TransactionCreditType, TransactionType } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenDistribution, TokenStatus } from '../../interfaces/models/token';
import { serverTime } from '../utils/dateTime.utils';
import { allPaymentsQuery, memberDocRef, orderDocRef } from '../utils/token.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

const getTokenCount = (token: Token, amount: number) => Math.floor(amount / token.pricePerToken)

const getBoughtByMemberCount = (totalSupply: number, totalBought: number, payedByMember: number) =>
  totalSupply >= totalBought ? payedByMember : Math.floor(payedByMember * 100 / totalBought / 100 * totalSupply)

const getMemberDistribution = (distribution: TokenDistribution, token: Token, totalSupply: number, totalBought: number): TokenDistribution => {
  const totalDeposit = distribution.totalDeposit || 0;
  const paidByMember = getTokenCount(token, totalDeposit)
  const boughtByMember = getBoughtByMemberCount(totalSupply, totalBought, paidByMember)
  const totalPaid = token.pricePerToken * boughtByMember
  const data = { ...distribution, totalPaid, totalBought: boughtByMember }
  if (totalSupply >= totalBought) {
    return { ...data, refundedAmount: 0 }
  }
  const refundedAmount = totalDeposit - (boughtByMember * token.pricePerToken)
  return { ...data, refundedAmount: refundedAmount < MIN_IOTA_AMOUNT ? 0 : refundedAmount }
}

const createBillPayment =
  (token: Token,
    distribution: TokenDistribution,
    payments: Transaction[],
    orderTargetAddress: string,
    space: Space,
    batch: admin.firestore.WriteBatch
  ) => {
    const tranId = getRandomEthAddress();
    const docRef = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
    const data = <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: tranId,
      space: token.space,
      member: distribution.member,
      createdOn: serverTime(),
      payload: {
        amount: distribution.totalPaid,
        sourceAddress: orderTargetAddress,
        targetAddress: space.validatedAddress,
        previousOwnerEntity: 'space',
        previousOwner: space.uid,
        sourceTransactions: payments.map(d => d.uid),
        reconciled: true,
        royalty: false,
        void: false,
      }
    };
    batch.create(docRef, data)
  }

const createCredit = async (
  token: Token,
  distribution: TokenDistribution,
  payments: Transaction[],
  orderTargetAddress: string,
  batch: admin.firestore.WriteBatch
) => {
  const member = <Member>(await memberDocRef(distribution.member!).get()).data()
  const tranId = getRandomEthAddress();
  const data = <Transaction>{
    type: TransactionType.CREDIT,
    uid: tranId,
    space: token.space,
    member: member.uid,
    createdOn: serverTime(),
    payload: {
      type: TransactionCreditType.TOKEN_PURCHASE,
      amount: distribution.refundedAmount,
      sourceAddress: orderTargetAddress,
      targetAddress: member.validatedAddress,
      sourceTransactions: payments.map(d => d.uid),
      token: token.uid,
      reconciled: true,
      void: false,
      invalidPayment: true
    }
  };
  batch.create(admin.firestore().collection(COL.TRANSACTION).doc(tranId), data)
}

const reconcileBuyer = (token: Token) => async (distribution: TokenDistribution) => {
  const batch = admin.firestore().batch();
  const distributionDoc = admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${distribution.member}`)
  batch.update(distributionDoc, { ...distribution, tokenOwned: admin.firestore.FieldValue.increment(distribution.totalBought || 0), reconciled: true })

  const spaceDoc = await admin.firestore().doc(`${COL.SPACE}/${token.space}`).get()

  const orderDoc = await orderDocRef(distribution.member!, token).get()
  const orderTargetAddress = orderDoc.data()?.payload?.targetAddress
  const payments = (await allPaymentsQuery(distribution.member!, token.uid).get()).docs.map(d => <Transaction>d.data())

  createBillPayment(token, distribution, payments, orderTargetAddress, <Space>spaceDoc.data(), batch)
  distribution.refundedAmount && await createCredit(token, distribution, payments, orderTargetAddress, batch)
  await batch.commit()
}

const distributeLeftoverTokens = (distributions: TokenDistribution[], totalPublicSupply: number, token: Token) => {
  let tokensLeft = totalPublicSupply - distributions.reduce((sum, p) => sum + p.totalBought!, 0)
  let i = 0;
  let sell = false;
  while (tokensLeft) {
    const distribution = { ...distributions[i] }
    if (distribution.refundedAmount! > token.pricePerToken) {
      sell = true;
      tokensLeft--;
      distribution.refundedAmount! -= token.pricePerToken
      distribution.totalBought! += 1
      distribution.totalPaid! += token.pricePerToken
      distributions[i] = distribution
    }
    i = (i + 1) % distributions.length
    if (i == 0 && !sell) {
      break;
    }
  }

}

export const onTokenStatusUpdate = functions.runWith({ timeoutSeconds: 540, memory: "512MB" })
  .firestore.document(COL.TOKEN + '/{tokenId}').onUpdate(async (change, context) => {
    const tokenId = context.params.tokenId
    const prev = change.before.data();
    const token = <Token | undefined>change.after.data();

    if (!token || token.status !== TokenStatus.PROCESSING || prev.status !== TokenStatus.AVAILABLE) {
      return;
    }

    const distributionsSnap = await admin.firestore().collection(`${COL.TOKEN}/${tokenId}/${SUB_COL.DISTRIBUTION}`).get()
    const totalBought = distributionsSnap.docs.reduce((sum, doc) => sum + getTokenCount(token, doc.data().totalDeposit), 0)

    const publicPercentage = token.allocations.find(a => a.isPublicSale)?.percentage || 0
    const totalPublicSupply = Math.floor(token.totalSupply * (publicPercentage / 100))

    const distributions = distributionsSnap.docs
      .filter(doc => doc.data().totalDeposit > 0)
      .sort((a, b) => b.data().totalDeposit - a.data().totalDeposit)
      .map(doc => getMemberDistribution(<TokenDistribution>doc.data(), token, totalPublicSupply, totalBought))

    distributeLeftoverTokens(distributions, totalPublicSupply, token);

    const promises = distributions.filter(p => !p.reconciled).map(reconcileBuyer(token))
    await Promise.all(promises);

    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).update({ status: TokenStatus.PRE_MINTED })
  })
