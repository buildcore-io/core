import {
  COL,
  DEFAULT_NETWORK,
  getNetworkPair,
  MilestoneTransactionEntry,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenDrop,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
  TransactionIgnoreWalletReason,
  TransactionOrder,
  TransactionOrderType,
  TRANSACTION_MAX_EXPIRY_MS,
  URL_PATHS,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import bigDecimal from 'js-big-decimal';
import { get, head, isEmpty } from 'lodash';
import admin from '../../../admin.config';
import { cOn, dateToTimestamp } from '../../../utils/dateTime.utils';
import { getBoughtByMemberDiff, getTotalPublicSupply } from '../../../utils/token.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class TokenService {
  constructor(readonly transactionService: TransactionService) {}

  public async handleTokenPurchaseRequest(order: TransactionOrder, match: TransactionMatch) {
    const payment = this.transactionService.createPayment(order, match);
    await this.updateTokenDistribution(order, match, payment);
  }

  public async handleTokenAirdropClaim(order: TransactionOrder, match: TransactionMatch) {
    const payment = this.transactionService.createPayment(order, match);
    this.transactionService.createCredit(payment, match);
    await this.claimAirdroppedTokens(order, payment, match);
  }

  public async handleMintedTokenAirdrop(
    order: TransactionOrder,
    tranOutput: MilestoneTransactionEntry,
    match: TransactionMatch,
  ) {
    const payment = this.transactionService.createPayment(order, match);
    const token = <Token>(
      (await admin.firestore().doc(`${COL.TOKEN}/${order.payload.token}`).get()).data()
    );
    const tokensSent = (tranOutput.nativeTokens || []).reduce(
      (acc, act) => (act.id === token.mintingData?.tokenId ? acc + Number(act.amount) : acc),
      0,
    );
    const tokensExpected = get(order, 'payload.drops', []).reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (acc: number, act: any) => acc + act.count,
      0,
    );
    if (tokensSent !== tokensExpected || (tranOutput.nativeTokens || []).length > 1) {
      this.transactionService.createCredit(payment, match);
      return;
    }
    await this.transactionService.markAsReconciled(order, match.msgId);
    const drops = get(order, 'payload.drops', []);
    for (let i = 0; i < drops.length; ++i) {
      const drop = drops[i];
      const airdropData = {
        parentId: token.uid,
        parentCol: COL.TOKEN,
        uid: drop.recipient.toLowerCase(),
        tokenDrops: admin.firestore.FieldValue.arrayUnion(<TokenDrop>{
          createdOn: dateToTimestamp(dayjs()),
          vestingAt: drop.vestingAt,
          count: drop.count,
          uid: getRandomEthAddress(),
          sourceAddress: order.payload.targetAddress,
          orderId: order.uid,
          stakeType: drop.stakeType || null,
        }),
      };
      const docRef = admin
        .firestore()
        .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${drop.recipient.toLowerCase()}`);
      this.transactionService.updates.push({
        ref: docRef,
        data: airdropData,
        action: 'set',
        merge: true,
      });
    }

    this.transactionService.updates.push({
      ref: admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`),
      data: { 'payload.amount': tranOutput.amount },
      action: 'update',
    });
  }

  public async handleTokenTradeRequest(
    order: TransactionOrder,
    tran: MilestoneTransactionEntry,
    match: TransactionMatch,
    soonTransaction?: Transaction,
  ) {
    const payment = this.transactionService.createPayment(order, match);

    const nativeTokenId = head(order.payload.nativeTokens)?.id;
    const nativeTokens = nativeTokenId
      ? Number(tran.nativeTokens?.find((n) => n.id === nativeTokenId)?.amount || 0)
      : 0;
    if (nativeTokenId && (!nativeTokens || (tran.nativeTokens?.length || 0) > 1)) {
      this.transactionService.createCredit(payment, match);
      return;
    }
    await this.transactionService.markAsReconciled(order, match.msgId);

    await this.createDistributionDocRef(order.payload.token!, order.member!);
    const token = <Token>(
      (await admin.firestore().doc(`${COL.TOKEN}/${order.payload.token}`).get()).data()
    );
    const network = order.network || DEFAULT_NETWORK;
    const data = cOn(
      <TokenTradeOrder>{
        uid: getRandomEthAddress(),
        owner: order.member,
        token: token.uid,
        tokenStatus: token.status,
        type:
          order.payload.type === TransactionOrderType.SELL_TOKEN
            ? TokenTradeOrderType.SELL
            : TokenTradeOrderType.BUY,
        count: nativeTokens || get(order, 'payload.count', 0),
        price: get(order, 'payload.price', 0),
        totalDeposit: nativeTokens || order.payload.amount,
        balance: nativeTokens || order.payload.amount,
        fulfilled: 0,
        status: TokenTradeOrderStatus.ACTIVE,
        orderTransactionId: order.uid,
        paymentTransactionId: payment.uid,
        expiresAt:
          soonTransaction?.payload?.expiresOn ||
          dateToTimestamp(dayjs().add(TRANSACTION_MAX_EXPIRY_MS, 'ms')),
        sourceNetwork: network,
        targetNetwork: token.status === TokenStatus.BASE ? getNetworkPair(network) : network,
      },
      URL_PATHS.TOKEN_MARKET,
    );
    const ref = admin.firestore().doc(`${COL.TOKEN_MARKET}/${data.uid}`);
    this.transactionService.updates.push({ ref, data, action: 'set' });

    if (
      order.payload.type === TransactionOrderType.SELL_TOKEN &&
      token.status === TokenStatus.MINTED
    ) {
      const orderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`);
      this.transactionService.updates.push({
        ref: orderDocRef,
        data: { 'payload.amount': match.to.amount },
        action: 'update',
      });
    }
  }

  private async updateTokenDistribution(
    order: Transaction,
    tran: TransactionMatch,
    payment: Transaction,
  ) {
    const tokenRef = admin.firestore().doc(`${COL.TOKEN}/${order.payload.token}`);
    const distributionRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${order.payload.token}/${SUB_COL.DISTRIBUTION}/${order.member}`);

    const token = <Token>(await this.transactionService.transaction.get(tokenRef)).data();
    if (token.status !== TokenStatus.AVAILABLE) {
      this.transactionService.createCredit(payment, tran);
      return;
    }

    const distribution = <TokenDistribution | undefined>(
      (await this.transactionService.transaction.get(distributionRef)).data()
    );
    const currentTotalDeposit = Number(
      bigDecimal.add(distribution?.totalDeposit || 0, tran.to.amount),
    );
    const boughtByMemberDiff = getBoughtByMemberDiff(
      distribution?.totalDeposit || 0,
      currentTotalDeposit,
      token.pricePerToken,
    );

    const tokenUpdateData = {
      totalDeposit: admin.firestore.FieldValue.increment(tran.to.amount),
      tokensOrdered: admin.firestore.FieldValue.increment(boughtByMemberDiff),
    };
    const tokensOrdered = Number(bigDecimal.add(token.tokensOrdered, boughtByMemberDiff));
    const totalPublicSupply = getTotalPublicSupply(token);

    this.transactionService.updates.push({
      ref: tokenRef,
      data:
        tokensOrdered >= totalPublicSupply && token.autoProcessAt100Percent
          ? { ...tokenUpdateData, status: TokenStatus.PROCESSING }
          : tokenUpdateData,
      action: 'update',
    });

    this.transactionService.updates.push({
      ref: distributionRef,
      data: {
        uid: order.member,
        totalDeposit: admin.firestore.FieldValue.increment(tran.to.amount),
        parentId: order.payload.token,
        parentCol: COL.TOKEN,
      },
      action: 'set',
      merge: true,
    });
  }

  private async claimAirdroppedTokens(
    order: Transaction,
    payment: Transaction,
    match: TransactionMatch,
  ) {
    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${order.payload.token}/${SUB_COL.DISTRIBUTION}/${order.member}`);
    const distribution = <TokenDistribution>(
      (await this.transactionService.transaction.get(distributionDocRef)).data()
    );
    const claimableDrops =
      distribution.tokenDrops?.filter((d) => dayjs(d.vestingAt.toDate()).isBefore(dayjs())) || [];
    if (isEmpty(claimableDrops)) {
      return;
    }
    await this.transactionService.markAsReconciled(order, match.msgId);
    this.transactionService.createBillPayment(
      order,
      payment,
      TransactionIgnoreWalletReason.PRE_MINTED_AIRDROP_CLAIM,
    );
    const dropCount = claimableDrops.reduce((sum, act) => sum + act.count, 0);
    const data = {
      tokenDrops: admin.firestore.FieldValue.arrayRemove(...claimableDrops),
      tokenDropsHistory: admin.firestore.FieldValue.arrayUnion(...claimableDrops),
      tokenClaimed: admin.firestore.FieldValue.increment(dropCount),
      tokenOwned: admin.firestore.FieldValue.increment(dropCount),
    };
    this.transactionService.updates.push({
      ref: distributionDocRef,
      data: data,
      action: 'update',
    });
  }

  private createDistributionDocRef = async (token: string, member: string) => {
    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${token}/${SUB_COL.DISTRIBUTION}/${member}`);
    const distributionDoc = await this.transactionService.transaction.get(distributionDocRef);
    if (!distributionDoc.exists) {
      const data = {
        uid: member,
        parentId: token,
        parentCol: COL.TOKEN,
      };
      this.transactionService.updates.push({
        ref: distributionDocRef,
        data,
        action: 'set',
        merge: true,
      });
    }
  };
}
