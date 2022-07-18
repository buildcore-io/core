import { SingleNodeClient } from '@iota/iota.js-next';
import dayjs from 'dayjs';
import bigDecimal from 'js-big-decimal';
import { isEmpty } from 'lodash';
import { URL_PATHS } from '../../../interfaces/config';
import { WenError } from '../../../interfaces/errors';
import { Member } from '../../../interfaces/models';
import { COL, SUB_COL } from '../../../interfaces/models/base';
import { MilestoneTransactionEntry } from '../../../interfaces/models/milestone';
import { Token, TokenDistribution, TokenStatus, TokenTradeOrder, TokenTradeOrderStatus, TokenTradeOrderType } from '../../../interfaces/models/token';
import { Network, Transaction, TransactionOrder, TRANSACTION_MAX_EXPIRY_MS } from '../../../interfaces/models/transaction';
import admin from '../../admin.config';
import { getAddress } from '../../utils/address.utils';
import { cOn, dateToTimestamp, serverTime } from "../../utils/dateTime.utils";
import { throwInvalidArgument } from '../../utils/error.utils';
import { getBoughtByMemberDiff, getTotalPublicSupply } from '../../utils/token.utils';
import { getRandomEthAddress } from "../../utils/wallet.utils";
import { SmrTokenMinter } from '../wallet/SmrTokenMinter';
import { getClaimableTokens, getDropsTotal } from '../wallet/token/claim-minted.utils';
import { getNodeClient, WalletService } from '../wallet/wallet';
import { TransactionMatch, TransactionService } from './transaction-service';

export class TokenService {

  constructor(readonly transactionService: TransactionService) { }

  public async handleTokenPurchaseRequest(orderData: TransactionOrder, match: TransactionMatch) {
    const payment = this.transactionService.createPayment(orderData, match);
    await this.updateTokenDistribution(orderData, match, payment)
  }

  public async handleTokenAirdrop(orderData: TransactionOrder, match: TransactionMatch) {
    const payment = this.transactionService.createPayment(orderData, match);
    await this.transactionService.markAsReconciled(orderData, match.msgId);
    await this.claimAirdroppedTokens(orderData, payment, match);
  }

  public async handleTokenBuyRequest(orderData: TransactionOrder, match: TransactionMatch) {
    const payment = this.transactionService.createPayment(orderData, match);
    await this.transactionService.markAsReconciled(orderData, match.msgId)
    await this.createTokenBuyRequest(orderData, payment)
  }

  public handleTokenMintingRequest = async (orderData: TransactionOrder, match: TransactionMatch) => {
    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${orderData.payload.token}`)
    const token = <Token>(await this.transactionService.transaction.get(tokenDocRef)).data()
    const payment = this.transactionService.createPayment(orderData, match);
    if (token.status !== TokenStatus.READY_TO_MINT) {
      this.transactionService.createCredit(payment, match);
      return;
    }
    await this.transactionService.markAsReconciled(orderData, match.msgId)

    const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${orderData.member}`).get()).data()

    const minter = new SmrTokenMinter(getNodeClient(orderData.targetNetwork!) as SingleNodeClient)
    const wallet = WalletService.newWallet(orderData.targetNetwork)
    const source = await wallet.getAddressDetails(orderData.payload.targetAddress)
    const target = await wallet.getAddressDetails(getAddress(member.validatedAddress, orderData.targetNetwork!))
    await minter.mintToken(source, target, token)

    const data = { status: TokenStatus.MINTING, mintingData: { mintedBy: orderData.member, network: orderData.targetNetwork } }
    this.transactionService.updates.push({ ref: tokenDocRef, data, action: 'update' });
  }

  public handleClaimMintedTokenRequest = async (orderData: TransactionOrder, match: TransactionMatch) => {
    const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${orderData.member}`).get()).data()
    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${orderData.payload.token}`)
    const token = <Token>(await this.transactionService.transaction.get(tokenDocRef)).data()

    const payment = this.transactionService.createPayment(orderData, match);
    try {
      const minter = new SmrTokenMinter(getNodeClient(orderData.targetNetwork!) as SingleNodeClient)
      const wallet = WalletService.newWallet(orderData.targetNetwork)
      const source = await wallet.getAddressDetails(orderData.payload.targetAddress)

      const drops = await getClaimableTokens(this.transactionService.transaction, member.uid, token)
      const blockId = await minter.claimMintedToken(member, token, source, drops)

      await this.transactionService.markAsReconciled(orderData, match.msgId)

      const isGuardian = (await admin.firestore().doc(`${COL.SPACE}/${token.space}/${SUB_COL.GUARDIANS}/${orderData.member}`).get()).exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tokenUpdateData: any = { 'mintingData.mintedTokens': admin.firestore.FieldValue.increment(getDropsTotal(drops)) }
      if (isGuardian && !token.mintingData?.claimedByGuardian) {
        tokenUpdateData['mintingData.claimedByGuardian'] = member.uid
      }
      this.transactionService.updates.push({ ref: tokenDocRef, data: tokenUpdateData, action: 'update' });

      const distDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${orderData.member}`)
      const distData = { mintedClaimedOn: serverTime(), mintingBlockId: blockId }
      this.transactionService.updates.push({ ref: distDocRef, data: distData, action: 'set', merge: true })
    } catch {
      this.transactionService.createCredit(payment, match);
    }
  }

  public handleSellMintedToken = async (order: TransactionOrder, tran: MilestoneTransactionEntry, match: TransactionMatch) => {
    const payment = this.transactionService.createPayment(order, match);
    await this.transactionService.markAsReconciled(order, match.msgId)

    const token = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${order.payload.token}`).get()).data()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const price = (order.payload as any).price || 0
    const nativeTokens = Number(tran.nativeTokens?.find(n => n.id === token.mintingData?.tokenId)?.amount)

    if (!nativeTokens || !price) {
      throw throwInvalidArgument(WenError.invalid_params)
    }

    const data = cOn(<TokenTradeOrder>{
      uid: getRandomEthAddress(),
      owner: order.member,
      token: order.payload.token,
      type: TokenTradeOrderType.SELL,
      count: nativeTokens,
      price,
      totalDeposit: Number(bigDecimal.floor(bigDecimal.multiply(nativeTokens, price))),
      balance: 0,
      fulfilled: 0,
      status: TokenTradeOrderStatus.ACTIVE,
      orderTransactionId: order.uid,
      paymentTransactionId: payment.uid,
      expiresAt: dateToTimestamp(dayjs().add(TRANSACTION_MAX_EXPIRY_MS, 'ms'))
    }, URL_PATHS.TOKEN_MARKET)
    const sellDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${data.uid}`);
    this.transactionService.updates.push({ ref: sellDocRef, data, action: 'set' });
  }

  public handleBaseTokenSell = async (order: TransactionOrder, match: TransactionMatch) => {
    const payment = this.transactionService.createPayment(order, match);
    await this.transactionService.markAsReconciled(order, match.msgId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, price } = order.payload as any;
    const data = cOn(<TokenTradeOrder>{
      uid: getRandomEthAddress(),
      owner: order.member,
      sourceNetwork: order.sourceNetwork,
      targetNetwork: order.targetNetwork,
      type: [Network.SMR, Network.RMS].includes(order.sourceNetwork!) ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY,
      token: '',
      count,
      price,
      totalDeposit: Number(bigDecimal.floor(bigDecimal.multiply(count, price))),
      balance: Number(bigDecimal.floor(bigDecimal.multiply(count, price))),
      fulfilled: 0,
      status: TokenTradeOrderStatus.ACTIVE,
      orderTransactionId: order.uid,
      paymentTransactionId: payment.uid,
      expiresAt: dateToTimestamp(dayjs().add(TRANSACTION_MAX_EXPIRY_MS, 'ms'))
    }, URL_PATHS.TOKEN_MARKET)
    const sellDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${data.uid}`);
    this.transactionService.updates.push({ ref: sellDocRef, data, action: 'set' });
  }

  private async updateTokenDistribution(order: Transaction, tran: TransactionMatch, payment: Transaction) {
    const tokenRef = admin.firestore().doc(`${COL.TOKEN}/${order.payload.token}`)
    const distributionRef = admin.firestore().doc(`${COL.TOKEN}/${order.payload.token}/${SUB_COL.DISTRIBUTION}/${order.member}`)

    const token = <Token>(await this.transactionService.transaction.get(tokenRef)).data()
    if (token.status !== TokenStatus.AVAILABLE) {
      this.transactionService.createCredit(payment, tran)
      return
    }

    const distribution = <TokenDistribution | undefined>(await this.transactionService.transaction.get(distributionRef)).data()
    const currentTotalDeposit = Number(bigDecimal.add(distribution?.totalDeposit || 0, tran.to.amount))
    const boughtByMemberDiff = getBoughtByMemberDiff(distribution?.totalDeposit || 0, currentTotalDeposit, token.pricePerToken)

    const tokenUpdateData = {
      totalDeposit: admin.firestore.FieldValue.increment(tran.to.amount),
      tokensOrdered: admin.firestore.FieldValue.increment(boughtByMemberDiff)
    }
    const tokensOrdered = Number(bigDecimal.add(token.tokensOrdered, boughtByMemberDiff))
    const totalPublicSupply = getTotalPublicSupply(token)

    this.transactionService.updates.push({
      ref: tokenRef,
      data: tokensOrdered >= totalPublicSupply && token.autoProcessAt100Percent ? { ...tokenUpdateData, status: TokenStatus.PROCESSING } : tokenUpdateData,
      action: 'update'
    });

    this.transactionService.updates.push({
      ref: distributionRef,
      data: {
        uid: order.member,
        totalDeposit: admin.firestore.FieldValue.increment(tran.to.amount),
        parentId: order.payload.token,
        parentCol: COL.TOKEN,
        createdOn: serverTime()
      },
      action: 'set',
      merge: true
    });


  }

  private async claimAirdroppedTokens(order: Transaction, payment: Transaction, match: TransactionMatch) {
    const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${order.payload.token}/${SUB_COL.DISTRIBUTION}/${order.member}`)
    const distribution = <TokenDistribution>(await this.transactionService.transaction.get(distributionDocRef)).data();
    const claimableDrops = distribution.tokenDrops?.filter(d => dayjs(d.vestingAt.toDate()).isBefore(dayjs())) || []
    if (isEmpty(claimableDrops)) {
      this.transactionService.createCredit(payment, match)
      return;
    }
    this.transactionService.createBillPayment(order, payment);
    const dropCount = claimableDrops.reduce((sum, act) => sum + act.count, 0)
    const data = {
      tokenDrops: admin.firestore.FieldValue.arrayRemove(...claimableDrops),
      tokenClaimed: admin.firestore.FieldValue.increment(dropCount),
      tokenOwned: admin.firestore.FieldValue.increment(dropCount)
    }
    this.transactionService.updates.push({
      ref: distributionDocRef,
      data: data,
      action: 'update'
    });
  }

  private async createTokenBuyRequest(order: Transaction, payment: Transaction) {
    const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${order.payload.token}/${SUB_COL.DISTRIBUTION}/${order.member}`)
    const distributionDoc = await this.transactionService.transaction.get(distributionDocRef)
    if (!distributionDoc.exists) {
      const data = {
        uid: order.member,
        parentId: order.payload.token,
        parentCol: COL.TOKEN,
      }
      this.transactionService.updates.push({ ref: distributionDocRef, data, action: 'set', merge: true });
    }
    const buyDocId = getRandomEthAddress()
    const data = cOn(<TokenTradeOrder>{
      uid: buyDocId,
      owner: order.member,
      token: order.payload.token,
      type: TokenTradeOrderType.BUY,
      count: order.payload.count,
      price: order.payload.price,
      totalDeposit: Number(bigDecimal.floor(bigDecimal.multiply(order.payload.count, order.payload.price))),
      balance: Number(bigDecimal.floor(bigDecimal.multiply(order.payload.count, order.payload.price))),
      fulfilled: 0,
      status: TokenTradeOrderStatus.ACTIVE,
      orderTransactionId: order.uid,
      paymentTransactionId: payment.uid,
      expiresAt: dateToTimestamp(dayjs().add(TRANSACTION_MAX_EXPIRY_MS, 'ms'))
    }, URL_PATHS.TOKEN_MARKET)
    const buyDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${buyDocId}`);
    this.transactionService.updates.push({ ref: buyDocRef, data, action: 'set' });
  }

}
