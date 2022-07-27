import * as functions from 'firebase-functions';
import bigDecimal from 'js-big-decimal';
import { isEmpty } from 'lodash';
import { DEFAULT_NETWORK, MIN_IOTA_AMOUNT, SECONDARY_TRANSACTION_DELAY } from '../../interfaces/config';
import { WEN_FUNC } from '../../interfaces/functions';
import { Member, Space, Transaction, TransactionCreditType, TransactionType } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenDistribution, TokenStatus } from '../../interfaces/models/token';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { getAddress } from '../utils/address.utils';
import { getRoyaltyPercentage, getRoyaltySpaces } from '../utils/config.utils';
import { serverTime } from '../utils/dateTime.utils';
import { allPaymentsQuery, BIG_DECIMAL_PRECISION, getTotalPublicSupply, memberDocRef, orderDocRef } from '../utils/token.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

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

const getRoyaltyFees = (amount: number) => {
  const percentage = getRoyaltyPercentage()
  const royaltySpaces = getRoyaltySpaces()
  if (isNaN(percentage) || !percentage || royaltySpaces.length < 1) {
    functions.logger.error('Token sale config is missing');
    return { royaltySpaceId: '', fee: 0 }
  }
  const fee = Number(bigDecimal.floor(bigDecimal.multiply(amount, percentage / 100)))
  return { royaltySpaceId: royaltySpaces[0], fee }
}

const createBillAndRoyaltyPayment =
  async (token: Token,
    distribution: TokenDistribution,
    payments: Transaction[],
    order: Transaction,
    space: Space,
    batch: admin.firestore.WriteBatch
  ) => {
    if (!distribution.totalPaid) {
      return { billPaymentId: '', royaltyBillPaymentId: '' }
    }
    let balance = distribution.totalPaid + (distribution.refundedAmount! < MIN_IOTA_AMOUNT ? distribution.refundedAmount! : 0)
    const { royaltySpaceId, fee } = getRoyaltyFees(balance)

    let royaltyPayment: Transaction | undefined = undefined
    if (fee >= MIN_IOTA_AMOUNT && balance - fee >= MIN_IOTA_AMOUNT) {
      const royaltySpace = <Space>(await admin.firestore().doc(`${COL.SPACE}/${royaltySpaceId}`).get()).data()
      royaltyPayment = <Transaction>{
        type: TransactionType.BILL_PAYMENT,
        uid: getRandomEthAddress(),
        space: token.space,
        member: distribution.uid,
        createdOn: serverTime(),
        sourceNetwork: order.sourceNetwork || DEFAULT_NETWORK,
        targetNetwork: order.targetNetwork || DEFAULT_NETWORK,
        payload: {
          amount: fee,
          sourceAddress: order.payload.targetAddress,
          targetAddress: getAddress(royaltySpace, order.targetNetwork!),
          previousOwnerEntity: 'member',
          previousOwner: distribution.uid,
          sourceTransaction: payments.map(d => d.uid),
          reconciled: false,
          royalty: true,
          void: false,
          token: token.uid,
          delay: SECONDARY_TRANSACTION_DELAY
        }
      };
      batch.create(admin.firestore().collection(COL.TRANSACTION).doc(royaltyPayment.uid), royaltyPayment)
      balance -= fee
    }

    const billPayment = <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      space: token.space,
      member: distribution.uid,
      createdOn: serverTime(),
      sourceNetwork: order.sourceNetwork || DEFAULT_NETWORK,
      targetNetwork: order.targetNetwork || DEFAULT_NETWORK,
      payload: {
        amount: balance,
        sourceAddress: order.payload.targetAddress,
        targetAddress: getAddress(space, order.targetNetwork!),
        previousOwnerEntity: 'member',
        previousOwner: distribution.uid,
        sourceTransaction: payments.map(d => d.uid),
        reconciled: false,
        royalty: false,
        void: false,
        token: token.uid,
        delay: SECONDARY_TRANSACTION_DELAY * 2,
        quantity: distribution.totalBought || 0
      }
    };
    batch.create(admin.firestore().collection(COL.TRANSACTION).doc(billPayment.uid), billPayment)
    return { billPaymentId: billPayment.uid, royaltyBillPaymentId: royaltyPayment?.uid || '' }
  }

const createCredit = async (
  token: Token,
  distribution: TokenDistribution,
  payments: Transaction[],
  order: Transaction,
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
    sourceNetwork: order.sourceNetwork || DEFAULT_NETWORK,
    targetNetwork: order.targetNetwork || DEFAULT_NETWORK,
    payload: {
      type: TransactionCreditType.TOKEN_PURCHASE,
      amount: distribution.refundedAmount,
      sourceAddress: order.payload.targetAddress,
      targetAddress: getAddress(member, order.targetNetwork!),
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

  const space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${token.space}`).get()).data()

  const order = <Transaction>(await orderDocRef(distribution.uid!, token).get()).data()
  const payments = (await allPaymentsQuery(distribution.uid!, token.uid).get()).docs.map(d => <Transaction>d.data())

  const { billPaymentId, royaltyBillPaymentId } = await createBillAndRoyaltyPayment(token, getFlooredDistribution(distribution), payments, order, space, batch)
  const creditPaymentId = await createCredit(token, getFlooredDistribution(distribution), payments, order, batch)

  batch.update(distributionDoc, {
    ...distribution,
    tokenOwned: admin.firestore.FieldValue.increment(distribution.totalBought || 0),
    reconciled: true,
    billPaymentId,
    royaltyBillPaymentId,
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

    const order = <Transaction>(await orderDocRef(distribution.uid!, token).get()).data()
    const payments = (await allPaymentsQuery(distribution.uid!, token.uid).get()).docs.map(d => <Transaction>d.data())
    const creditPaymentId = await createCredit(token, { ...distribution, refundedAmount: distribution?.totalDeposit }, payments, order, batch)

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

    const totalPublicSupply = getTotalPublicSupply(token)

    const distributions = distributionsSnap.docs
      .sort((a, b) => b.data().totalDeposit - a.data().totalDeposit)
      .map(d => getMemberDistribution(<TokenDistribution>d.data(), token, totalPublicSupply, totalBought))

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
