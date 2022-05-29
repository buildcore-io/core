import * as functions from 'firebase-functions';
import bigDecimal from 'js-big-decimal';
import { isEmpty } from 'lodash';
import { MIN_IOTA_AMOUNT, SECONDARY_TRANSACTION_DELAY } from '../../interfaces/config';
import { WEN_FUNC } from '../../interfaces/functions';
import { Member, Space, Transaction, TransactionCreditType, TransactionType } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenDistribution, TokenStatus } from '../../interfaces/models/token';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { serverTime } from '../utils/dateTime.utils';
import { allPaymentsQuery, memberDocRef, orderDocRef } from '../utils/token.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

const BIG_DECIMAL_PRECISION = 1000

const getTokenCount = (token: Token, amount: number) => Math.floor(amount / token.pricePerToken)

const getBoughtByMember = (token: Token, totalDeposit: number, totalSupply: number, totalBought: number) => {
  const boughtByMember = bigDecimal.floor(bigDecimal.divide(totalDeposit, token.pricePerToken, BIG_DECIMAL_PRECISION))
  const percentageBought = bigDecimal.divide(bigDecimal.multiply(boughtByMember, 100), Math.max(totalSupply, totalBought), BIG_DECIMAL_PRECISION)
  const total = bigDecimal.floor(bigDecimal.divide(bigDecimal.multiply(totalSupply, percentageBought), 100, BIG_DECIMAL_PRECISION))
  return Number(total)
}

const getTotalPaid = (pricePerToken: number, boughtByMember: number) => {
  const totalPaid = Number(bigDecimal.multiply(pricePerToken, boughtByMember))
  return totalPaid < MIN_IOTA_AMOUNT ? 0 : totalPaid
}

const getMemberDistribution = (distribution: TokenDistribution, token: Token, totalSupply: number, totalBought: number): TokenDistribution => {
  const totalDeposit = distribution.totalDeposit || 0;
  const boughtByMember = getBoughtByMember(token, totalDeposit, totalSupply, totalBought)
  const totalPaid = getTotalPaid(token.pricePerToken, boughtByMember)
  const refundedAmount = Number(bigDecimal.subtract(totalDeposit, totalPaid))
  return <TokenDistribution>{
    uid: distribution.uid,
    totalDeposit: distribution.totalDeposit || 0,
    totalPaid,
    refundedAmount,
    totalBought: boughtByMember,
    reconciled: distribution.reconciled || false
  }
}

const getFlooredDistribution = (distribution: TokenDistribution): TokenDistribution => {
  const totalPaid = Math.floor(distribution.totalPaid!);
  const refundedAmount = Number(bigDecimal.subtract(distribution.totalDeposit!, totalPaid));
  return { ...distribution, totalPaid, refundedAmount }
}

const createBillPayment =
  (token: Token,
    distribution: TokenDistribution,
    payments: Transaction[],
    orderTargetAddress: string,
    space: Space,
    batch: admin.firestore.WriteBatch
  ) => {
    if (!distribution.totalPaid) {
      return ''
    }
    const tranId = getRandomEthAddress();
    const docRef = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
    const data = <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: tranId,
      space: token.space,
      member: distribution.uid,
      createdOn: serverTime(),
      payload: {
        amount: distribution.totalPaid + (distribution.refundedAmount! < MIN_IOTA_AMOUNT ? distribution.refundedAmount! : 0),
        sourceAddress: orderTargetAddress,
        targetAddress: space.validatedAddress,
        previousOwnerEntity: 'space',
        previousOwner: space.uid,
        sourceTransaction: payments.map(d => d.uid),
        reconciled: true,
        royalty: false,
        void: false,
        token: token.uid,
        // We delay royalty.
        delay: SECONDARY_TRANSACTION_DELAY,
        quantity: distribution.totalBought || 0
      }
    };
    batch.create(docRef, data)
    return tranId
  }

const createCredit = async (
  token: Token,
  distribution: TokenDistribution,
  payments: Transaction[],
  orderTargetAddress: string,
  batch: admin.firestore.WriteBatch
) => {
  if (!distribution.refundedAmount) {
    return ''
  }
  const member = <Member>(await memberDocRef(distribution.uid!).get()).data()
  const tranId = getRandomEthAddress();
  const docRef = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
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
      sourceTransaction: payments.map(d => d.uid),
      token: token.uid,
      reconciled: true,
      void: false,
      invalidPayment: distribution.refundedAmount! < MIN_IOTA_AMOUNT
    },
    ignoreWallet: distribution.refundedAmount! < MIN_IOTA_AMOUNT
  };
  batch.create(docRef, data)
  return tranId
}

const reconcileBuyer = (token: Token) => async (distribution: TokenDistribution) => {
  const batch = admin.firestore().batch();
  const distributionDoc = admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${distribution.uid}`)

  const spaceDoc = await admin.firestore().doc(`${COL.SPACE}/${token.space}`).get()

  const orderDoc = await orderDocRef(distribution.uid!, token).get()
  const orderTargetAddress = orderDoc.data()?.payload?.targetAddress || ''
  const payments = (await allPaymentsQuery(distribution.uid!, token.uid).get()).docs.map(d => <Transaction>d.data())

  const billPaymentId = createBillPayment(token, getFlooredDistribution(distribution), payments, orderTargetAddress, <Space>spaceDoc.data(), batch)
  const creditPaymentId = await createCredit(token, getFlooredDistribution(distribution), payments, orderTargetAddress, batch)

  batch.update(distributionDoc, {
    ...distribution,
    tokenOwned: admin.firestore.FieldValue.increment(distribution.totalBought || 0),
    reconciled: true,
    billPaymentId,
    creditPaymentId
  })
  await batch.commit()
}

const distributeLeftoverTokens = (distributions: TokenDistribution[], totalPublicSupply: number, token: Token) => {
  let tokensLeft = totalPublicSupply - distributions.reduce((sum, p) => sum + p.totalBought!, 0)
  let i = 0;
  let sell = false;
  while (tokensLeft) {
    const distribution = { ...distributions[i] }
    if (distribution.refundedAmount! >= token.pricePerToken) {
      sell = true;
      tokensLeft--;
      distribution.refundedAmount = Number(bigDecimal.subtract(distribution.refundedAmount, token.pricePerToken))
      distribution.totalBought! += 1
      distribution.totalPaid = Number(bigDecimal.add(distribution.totalPaid, token.pricePerToken))
      distributions[i] = distribution
    }
    i = (i + 1) % distributions.length
    if (i == 0 && !sell) {
      break;
    }
  }

}

const cancelPublicSale = async (token: Token) => {
  const distributionDocs = (await admin.firestore().collection(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}`)
    .where('totalDeposit', '>', 0)
    .get()).docs

  const promises = distributionDocs.map(async (doc) => {
    const distribution = <TokenDistribution>doc.data()
    const batch = admin.firestore().batch()

    const orderDoc = await orderDocRef(distribution.uid!, token).get()
    const orderTargetAddress = orderDoc.data()?.payload?.targetAddress || ''
    const payments = (await allPaymentsQuery(distribution.uid!, token.uid).get()).docs.map(d => <Transaction>d.data())
    const creditPaymentId = await createCredit(token, { ...distribution, refundedAmount: distribution?.totalDeposit }, payments, orderTargetAddress, batch)

    batch.update(doc.ref, { creditPaymentId, totalDeposit: 0 })

    await batch.commit()
  })

  const results = await Promise.allSettled(promises);
  const errors = results.filter(r => r.status === 'rejected').map(r => String((<PromiseRejectedResult>r).reason))
  const status = isEmpty(errors) ? TokenStatus.AVAILABLE : TokenStatus.ERROR
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ status })

  if (status === TokenStatus.ERROR) {
    functions.logger.error('Token processing error', token.uid, errors)
  }
}

export const onTokenStatusUpdate = functions.runWith({ timeoutSeconds: 540, memory: "4GB", minInstances: scale(WEN_FUNC.onTokenStatusUpdate) })
  .firestore.document(COL.TOKEN + '/{tokenId}').onUpdate(async (change, context) => {
    const tokenId = context.params.tokenId
    const prev = <Token | undefined>change.before.data();
    const token = <Token | undefined>change.after.data();

    const statuses = [TokenStatus.PROCESSING, TokenStatus.CANCEL_SALE]

    if (!token?.status || !prev?.status || !statuses.includes(token.status) || prev.status !== TokenStatus.AVAILABLE) {
      return
    }

    if (token.status === TokenStatus.CANCEL_SALE) {
      return await cancelPublicSale(token)
    }

    const distributionsSnap = await admin.firestore().collection(`${COL.TOKEN}/${tokenId}/${SUB_COL.DISTRIBUTION}`).where('totalDeposit', '>', 0).get()
    const totalBought = distributionsSnap.docs.reduce((sum, doc) => sum + getTokenCount(token, doc.data().totalDeposit), 0)

    const publicPercentage = token.allocations.find(a => a.isPublicSale)?.percentage || 0
    const totalPublicSupply = Math.floor(token.totalSupply * (publicPercentage / 100))

    const distributions = distributionsSnap.docs
      .sort((a, b) => b.data().totalDeposit - a.data().totalDeposit)
      .map(doc => getMemberDistribution(<TokenDistribution>doc.data(), token, totalPublicSupply, totalBought))

    if (totalBought > totalPublicSupply) {
      distributeLeftoverTokens(distributions, totalPublicSupply, token);
    }

    const promises = distributions.filter(p => !p.reconciled).map(reconcileBuyer(token))
    const results = await Promise.allSettled(promises);
    const errors = results.filter(r => r.status === 'rejected').map(r => String((<PromiseRejectedResult>r).reason))
    const status = isEmpty(errors) ? TokenStatus.PRE_MINTED : TokenStatus.ERROR
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).update({ status })

    if (status === TokenStatus.ERROR) {
      functions.logger.error('Token processing error', token.uid, errors)
    }
  })
