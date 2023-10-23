import { build5Db } from '@build-5/database';
import {
  COL,
  DEFAULT_NETWORK,
  NativeToken,
  SUB_COL,
  TRANSACTION_MAX_EXPIRY_MS,
  Token,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  TransactionPayloadType,
  getNetworkPair,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { get, head, set } from 'lodash';
import { getProjects } from '../../../utils/common.utils';
import { dateToTimestamp } from '../../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { BaseService, HandlerParams } from '../base';

export class TokenTradeService extends BaseService {
  public handleRequest = async ({
    project,
    order,
    match,
    tranEntry,
    build5Tran,
  }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);

    const nativeTokenId = head(order.payload.nativeTokens as NativeToken[])?.id;
    const nativeTokens = nativeTokenId
      ? Number(tranEntry.nativeTokens?.find((n) => n.id === nativeTokenId)?.amount || 0)
      : 0;
    if (nativeTokenId && (!nativeTokens || (tranEntry.nativeTokens?.length || 0) > 1)) {
      await this.transactionService.createCredit(
        TransactionPayloadType.INVALID_AMOUNT,
        payment,
        match,
      );
      return;
    }
    this.transactionService.markAsReconciled(order, match.msgId);

    await this.createDistributionDocRef(order.payload.token!, order.member!);
    const token = <Token>await build5Db().doc(`${COL.TOKEN}/${order.payload.token}`).get();
    const network = order.network || DEFAULT_NETWORK;
    const data: TokenTradeOrder = {
      project,
      projects: getProjects([order], project),
      uid: getRandomEthAddress(),
      owner: order.member!,
      token: token.uid,
      tokenStatus: token.status,
      type:
        order.payload.type === TransactionPayloadType.SELL_TOKEN
          ? TokenTradeOrderType.SELL
          : TokenTradeOrderType.BUY,
      count: nativeTokens || get(order, 'payload.count', 0),
      price: get(order, 'payload.price', 0),
      totalDeposit: nativeTokens || order.payload.amount || 0,
      balance: nativeTokens || order.payload.amount || 0,
      fulfilled: 0,
      status: TokenTradeOrderStatus.ACTIVE,
      orderTransactionId: order.uid,
      paymentTransactionId: payment.uid,
      expiresAt:
        build5Tran?.payload?.expiresOn ||
        dateToTimestamp(dayjs().add(TRANSACTION_MAX_EXPIRY_MS, 'ms')),
      sourceNetwork: network,
      targetNetwork: token.status === TokenStatus.BASE ? getNetworkPair(network) : network,
    };
    if (order.payload.tokenTradeOderTargetAddress) {
      set(data, 'targetAddress', order.payload.tokenTradeOderTargetAddress);
    }

    const ref = build5Db().doc(`${COL.TOKEN_MARKET}/${data.uid}`);
    this.transactionService.push({ ref, data, action: 'set' });

    if (
      order.payload.type === TransactionPayloadType.SELL_TOKEN &&
      token.status === TokenStatus.MINTED
    ) {
      const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
      this.transactionService.push({
        ref: orderDocRef,
        data: { 'payload.amount': match.to.amount },
        action: 'update',
      });
    }
  };

  private createDistributionDocRef = async (token: string, member: string) => {
    const distributionDocRef = build5Db().doc(
      `${COL.TOKEN}/${token}/${SUB_COL.DISTRIBUTION}/${member}`,
    );
    const distributionDoc = await this.transactionService.transaction.get(distributionDocRef);
    if (!distributionDoc) {
      const data = {
        uid: member,
        parentId: token,
        parentCol: COL.TOKEN,
      };
      this.transactionService.push({
        ref: distributionDocRef,
        data,
        action: 'set',
        merge: true,
      });
    }
  };
}
