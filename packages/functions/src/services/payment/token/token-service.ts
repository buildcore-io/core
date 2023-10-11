import {
  COL,
  DEFAULT_NETWORK,
  MilestoneTransactionEntry,
  NativeToken,
  SUB_COL,
  TRANSACTION_MAX_EXPIRY_MS,
  Token,
  TokenDistribution,
  TokenDrop,
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
import { get, head, last, set } from 'lodash';
import { build5Db, getSnapshot } from '../../../firebase/firestore/build5Db';
import { dateToTimestamp } from '../../../utils/dateTime.utils';
import { getBoughtByMemberDiff, getTotalPublicSupply } from '../../../utils/token.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class TokenService {
  constructor(readonly transactionService: TransactionService) {}

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
    const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${order.payload.token}`);
    const token = <Token>await tokenDocRef.get();
    const tokensSent = (tranOutput.nativeTokens || []).reduce(
      (acc, act) => (act.id === token.mintingData?.tokenId ? acc + Number(act.amount) : acc),
      0,
    );
    const tokensExpected = get(order, 'payload.totalAirdropCount', 0);

    if (tokensSent !== tokensExpected || (tranOutput.nativeTokens || []).length > 1) {
      await this.transactionService.createCredit(
        TransactionPayloadType.INVALID_AMOUNT,
        payment,
        match,
      );
      return;
    }

    let lastDocId = '';
    do {
      const lastDoc = await getSnapshot(COL.AIRDROP, lastDocId);
      const snap = await build5Db()
        .collection(COL.AIRDROP)
        .where('orderId', '==', order.uid)
        .limit(250)
        .startAfter(lastDoc)
        .get<TokenDrop>();
      lastDocId = last(snap)?.uid || '';

      const batch = build5Db().batch();
      snap.forEach((airdrop) => {
        const distributionDocRef = build5Db()
          .collection(COL.TOKEN)
          .doc(airdrop.token)
          .collection(SUB_COL.DISTRIBUTION)
          .doc(airdrop.member);

        batch.set(
          distributionDocRef,
          {
            parentId: airdrop.token,
            parentCol: COL.TOKEN,
            uid: airdrop.member,
            totalUnclaimedAirdrop: build5Db().inc(airdrop.count),
          },
          true,
        );
        const docRef = build5Db().doc(`${COL.AIRDROP}/${airdrop.uid}`);
        batch.update(docRef, { status: TokenDropStatus.UNCLAIMED });
      });
      await batch.commit();
    } while (lastDocId);

    this.transactionService.markAsReconciled(order, match.msgId);

    this.transactionService.push({
      ref: build5Db().doc(`${COL.TRANSACTION}/${order.uid}`),
      data: { 'payload.amount': tranOutput.amount },
      action: 'update',
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
    const token = <Token>await build5Db().doc(`${COL.TOKEN}/${order.payload.token}`).get();
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
      count: nativeTokens || get(order, 'payload.count', 0),
      price: get(order, 'payload.price', 0),
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
  }

  private async updateTokenDistribution(
    order: Transaction,
    tran: TransactionMatch,
    payment: Transaction,
  ) {
    const tokenRef = build5Db().doc(`${COL.TOKEN}/${order.payload.token}`);
    const distributionRef = tokenRef.collection(SUB_COL.DISTRIBUTION).doc(order.member!);

    const token = <Token>await this.transactionService.get(tokenRef);
    if (token.status !== TokenStatus.AVAILABLE) {
      await this.transactionService.createCredit(
        TransactionPayloadType.DATA_NO_LONGER_VALID,
        payment,
        tran,
      );
      return;
    }

    const distribution = await this.transactionService.transaction.get<TokenDistribution>(
      distributionRef,
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
      action: 'update',
    });

    this.transactionService.push({
      ref: distributionRef,
      data: {
        uid: order.member,
        totalDeposit: build5Db().inc(tran.to.amount),
        parentId: order.payload.token,
        parentCol: COL.TOKEN,
      },
      action: 'set',
      merge: true,
    });
  }

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
