import { ITransaction, build5Db } from '@build-5/database';
import {
  COL,
  DEFAULT_NETWORK,
  MilestoneTransactionEntry,
  NativeToken,
  SUB_COL,
  TRANSACTION_MAX_EXPIRY_MS,
  Token,
  TokenDropStatus,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
  TransactionPayloadType,
  getNetworkPair,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import bigDecimal from 'js-big-decimal';
import { head, set } from 'lodash';
import { dateToTimestamp } from '../../../utils/dateTime.utils';
import { getBoughtByMemberDiff, getTotalPublicSupply } from '../../../utils/token.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { Action, TransactionMatch, TransactionService } from '../transaction-service';

export class TokenService {
  private transaction: ITransaction;
  constructor(readonly transactionService: TransactionService) {
    this.transaction = transactionService.transaction;
  }

  public async handleTokenPurchaseRequest(order: Transaction, match: TransactionMatch) {
    const payment = await this.transactionService.createPayment(order, match);
    await this.updateTokenDistribution(order, match, payment);
  }

  public async handleTokenAirdropClaim(order: Transaction, match: TransactionMatch) {
    const payment = await this.transactionService.createPayment(order, match);
    await this.transactionService.createCredit(
      TransactionPayloadType.PRE_MINTED_CLAIM,
      payment,
      match,
    );
    this.transactionService.markAsReconciled(order, match.msgId);
  }

  public async handleMintedTokenAirdrop(
    order: Transaction,
    tranOutput: MilestoneTransactionEntry,
    match: TransactionMatch,
  ) {
    const payment = await this.transactionService.createPayment(order, match);
    const tokenDocRef = build5Db().doc(COL.TOKEN, order.payload.token!);
    const token = <Token>await tokenDocRef.get();
    const tokensSent = (tranOutput.nativeTokens || []).reduce(
      (acc, act) => (act.id === token.mintingData?.tokenId ? acc + Number(act.amount) : acc),
      0,
    );
    const tokensExpected = order.payload.totalAirdropCount || 0;

    if (tokensSent !== tokensExpected || (tranOutput.nativeTokens || []).length > 1) {
      await this.transactionService.createCredit(
        TransactionPayloadType.INVALID_AMOUNT,
        payment,
        match,
      );
      return;
    }

    const snap = await build5Db()
      .collection(COL.AIRDROP)
      .where('orderId', '==', order.uid)
      .where('status', '==', TokenDropStatus.DEPOSIT_NEEDED)
      .get();

    for (const airdrop of snap) {
      const distributionDocRef = build5Db().doc(
        COL.TOKEN,
        airdrop.token,
        SUB_COL.DISTRIBUTION,
        airdrop.member,
      );

      await this.transaction.upsert(distributionDocRef, {
        parentId: airdrop.token,
        totalUnclaimedAirdrop: build5Db().inc(airdrop.count),
      });
      const docRef = build5Db().doc(COL.AIRDROP, airdrop.uid);
      await this.transaction.update(docRef, { status: TokenDropStatus.UNCLAIMED });
    }

    this.transactionService.markAsReconciled(order, match.msgId);

    this.transactionService.push({
      ref: build5Db().doc(COL.TRANSACTION, order.uid),
      data: { payload_amount: tranOutput.amount },
      action: Action.U,
    });
  }

  public async handleTokenTradeRequest(
    order: Transaction,
    tran: MilestoneTransactionEntry,
    match: TransactionMatch,
    build5Transaction?: Transaction,
  ) {
    const payment = await this.transactionService.createPayment(order, match);

    const nativeTokenId = head(order.payload.nativeTokens as NativeToken[])?.id;
    const nativeTokens = nativeTokenId
      ? Number(tran.nativeTokens?.find((n) => n.id === nativeTokenId)?.amount || 0)
      : 0;
    if (nativeTokenId && (!nativeTokens || (tran.nativeTokens?.length || 0) > 1)) {
      await this.transactionService.createCredit(
        TransactionPayloadType.INVALID_AMOUNT,
        payment,
        match,
      );
      return;
    }
    this.transactionService.markAsReconciled(order, match.msgId);

    await this.createDistributionDocRef(order.payload.token!, order.member!);
    const token = <Token>await build5Db().doc(COL.TOKEN, order.payload.token!).get();
    const network = order.network || DEFAULT_NETWORK;
    const data = <TokenTradeOrder>{
      uid: getRandomEthAddress(),
      owner: order.member,
      token: token.uid,
      tokenStatus: token.status,
      type:
        order.payload.type === TransactionPayloadType.SELL_TOKEN
          ? TokenTradeOrderType.SELL
          : TokenTradeOrderType.BUY,
      count: nativeTokens || order.payload.count || 0,
      price: order.payload.price || 0,
      totalDeposit: nativeTokens || order.payload.amount,
      balance: nativeTokens || order.payload.amount,
      fulfilled: 0,
      status: TokenTradeOrderStatus.ACTIVE,
      orderTransactionId: order.uid,
      paymentTransactionId: payment.uid,
      expiresAt:
        build5Transaction?.payload?.expiresOn ||
        dateToTimestamp(dayjs().add(TRANSACTION_MAX_EXPIRY_MS, 'ms')),
      sourceNetwork: network,
      targetNetwork: token.status === TokenStatus.BASE ? getNetworkPair(network) : network,
    };
    if (order.payload.tokenTradeOderTargetAddress) {
      set(data, 'targetAddress', order.payload.tokenTradeOderTargetAddress);
    }

    const ref = build5Db().doc(COL.TOKEN_MARKET, data.uid);
    this.transactionService.push({ ref, data, action: Action.C });

    if (
      order.payload.type === TransactionPayloadType.SELL_TOKEN &&
      token.status === TokenStatus.MINTED
    ) {
      const orderDocRef = build5Db().doc(COL.TRANSACTION, order.uid);
      this.transactionService.push({
        ref: orderDocRef,
        data: { payload_amount: match.to.amount },
        action: Action.U,
      });
    }
  }

  private async updateTokenDistribution(
    order: Transaction,
    tran: TransactionMatch,
    payment: Transaction,
  ) {
    const tokenRef = build5Db().doc(COL.TOKEN, order.payload.token!);
    const distributionRef = build5Db().doc(
      COL.TOKEN,
      order.payload.token!,
      SUB_COL.DISTRIBUTION,
      order.member!,
    );

    const token = <Token>await tokenRef.get();
    if (token.status !== TokenStatus.AVAILABLE) {
      await this.transactionService.createCredit(
        TransactionPayloadType.DATA_NO_LONGER_VALID,
        payment,
        tran,
      );
      return;
    }

    const distribution = await distributionRef.get();
    const currentTotalDeposit = Number(
      bigDecimal.add(distribution?.totalDeposit || 0, tran.to.amount),
    );
    const boughtByMemberDiff = getBoughtByMemberDiff(
      distribution?.totalDeposit || 0,
      currentTotalDeposit,
      token.pricePerToken,
    );

    const tokenUpdateData = {
      totalDeposit: build5Db().inc(tran.to.amount),
      tokensOrdered: build5Db().inc(boughtByMemberDiff),
    };
    const tokensOrdered = Number(bigDecimal.add(token.tokensOrdered, boughtByMemberDiff));
    const totalPublicSupply = getTotalPublicSupply(token);

    this.transactionService.push({
      ref: tokenRef,
      data:
        tokensOrdered >= totalPublicSupply && token.autoProcessAt100Percent
          ? { ...tokenUpdateData, status: TokenStatus.PROCESSING }
          : tokenUpdateData,
      action: Action.U,
    });

    this.transactionService.push({
      ref: distributionRef,
      data: {
        totalDeposit: build5Db().inc(tran.to.amount),
        parentId: order.payload.token,
      },
      action: Action.UPS,
    });
  }

  private createDistributionDocRef = async (token: string, member: string) => {
    const distributionDocRef = build5Db().doc(COL.TOKEN, token, SUB_COL.DISTRIBUTION, member);
    const distributionDoc = await this.transaction.get(distributionDocRef);
    if (!distributionDoc) {
      const data = { uid: member, parentId: token, parentCol: COL.TOKEN };
      this.transactionService.push({ ref: distributionDocRef, data, action: Action.C });
    }
  };
}
