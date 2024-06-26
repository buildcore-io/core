import { database } from '@buildcore/database';
import {
  COL,
  DEFAULT_NETWORK,
  MAX_TOTAL_TOKEN_SUPPLY,
  MilestoneTransactionEntry,
  NativeToken,
  SUB_COL,
  TRANSACTION_MAX_EXPIRY_MS,
  Token,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
  TransactionPayloadType,
  getNetworkPair,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { head, isEqual, set } from 'lodash';
import { dateToTimestamp } from '../../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { BaseService, HandlerParams } from '../base';
import { Action } from '../transaction-service';

export class TokenTradeService extends BaseService {
  public handleRequest = async ({
    project,
    order,
    match,
    tranEntry,
    buildcoreTran,
  }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);

    const expectedNativeTokenIds = [head(order.payload.nativeTokens as NativeToken[])?.id].filter(
      (n) => n !== undefined,
    );
    const receivedNativeTokenIds = tranEntry.nativeTokens?.map((n) => n.id);

    if (!isEqual(expectedNativeTokenIds, receivedNativeTokenIds)) {
      await this.transactionService.createCredit(
        TransactionPayloadType.INVALID_AMOUNT,
        payment,
        match,
      );
      return;
    }
    this.transactionService.markAsReconciled(order, match.msgId);
    const nativeTokens = Number(head(tranEntry.nativeTokens)?.amount);

    await this.createDistributionDocRef(order.payload.token!, order.member!);
    const token = <Token>await database().doc(COL.TOKEN, order.payload.token!).get();
    const network = order.network || DEFAULT_NETWORK;

    const type =
      order.payload.type === TransactionPayloadType.SELL_TOKEN
        ? TokenTradeOrderType.SELL
        : TokenTradeOrderType.BUY;
    const price = order.payload.price || 0;
    const count = getCount(order, tranEntry, type);

    const data: TokenTradeOrder = {
      project,
      uid: getRandomEthAddress(),
      owner: order.member!,
      token: token.uid,
      tokenStatus: token.status,
      type,
      count,
      price,
      totalDeposit: nativeTokens || match.to.amount || 0,
      balance: nativeTokens || match.to.amount || 0,
      fulfilled: 0,
      status: TokenTradeOrderStatus.ACTIVE,
      orderTransactionId: order.uid,
      paymentTransactionId: payment.uid,
      expiresAt:
        buildcoreTran?.payload?.expiresOn ||
        dateToTimestamp(dayjs().add(TRANSACTION_MAX_EXPIRY_MS, 'ms')),
      sourceNetwork: network,
      targetNetwork: token.status === TokenStatus.BASE ? getNetworkPair(network) : network,
    };
    if (order.payload.tokenTradeOderTargetAddress) {
      set(data, 'targetAddress', order.payload.tokenTradeOderTargetAddress);
    }

    const ref = database().doc(COL.TOKEN_MARKET, data.uid);
    this.transactionService.push({ ref, data, action: Action.C });

    const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
    this.transactionService.push({
      ref: orderDocRef,
      data: { payload_amount: match.to.amount, payload_count: count },
      action: Action.U,
    });
  };

  private createDistributionDocRef = async (token: string, member: string) => {
    const distributionDocRef = database().doc(COL.TOKEN, token, SUB_COL.DISTRIBUTION, member);
    const distributionDoc = await this.transaction.get(distributionDocRef);
    if (!distributionDoc) {
      const data = {
        uid: member,
        parentId: token,
        parentCol: COL.TOKEN,
      };
      this.transactionService.push({ ref: distributionDocRef, data, action: Action.UPS });
    }
  };
}

const getCount = (
  order: Transaction,
  tranEntry: MilestoneTransactionEntry,
  type: TokenTradeOrderType,
) => {
  if (type === TokenTradeOrderType.SELL) {
    return Number(head(tranEntry.nativeTokens)?.amount || 0) || tranEntry.amount;
  }
  return order.payload.count || MAX_TOTAL_TOKEN_SUPPLY;
};
