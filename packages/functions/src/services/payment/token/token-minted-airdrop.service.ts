import { build5Db } from '@build-5/database';
import { COL, SUB_COL, Token, TokenDropStatus, TransactionPayloadType } from '@build-5/interfaces';
import { BaseService, HandlerParams } from '../base';
import { Action } from '../transaction-service';

export class TokenMintedAirdropService extends BaseService {
  public handleRequest = async ({ order, match, tranEntry }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);
    const tokenDocRef = build5Db().doc(COL.TOKEN, order.payload.token!);
    const token = <Token>await tokenDocRef.get();
    const tokensSent = (tranEntry.nativeTokens || []).reduce(
      (acc, act) => (act.id === token.mintingData?.tokenId ? acc + Number(act.amount) : acc),
      0,
    );
    const tokensExpected = order.payload.totalAirdropCount || 0;

    if (tokensSent !== tokensExpected || (tranEntry.nativeTokens || []).length > 1) {
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
      data: { payload_amount: tranEntry.amount },
      action: Action.U,
    });
  };
}
