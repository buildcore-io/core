import { database } from '@buildcore/database';
import {
  COL,
  SUB_COL,
  Token,
  TokenDropStatus,
  TransactionPayloadType,
} from '@buildcore/interfaces';
import { BaseService, HandlerParams } from '../base';
import { Action } from '../transaction-service';

export class TokenMintedAirdropService extends BaseService {
  public handleRequest = async ({ order, match, tranEntry }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);
    const tokenDocRef = database().doc(COL.TOKEN, order.payload.token!);
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
    const snap = await database()
      .collection(COL.AIRDROP)
      .where('orderId', '==', order.uid)
      .where('status', '==', TokenDropStatus.DEPOSIT_NEEDED)
      .get();

    for (const airdrop of snap) {
      const distributionDocRef = database().doc(
        COL.TOKEN,
        airdrop.token,
        SUB_COL.DISTRIBUTION,
        airdrop.member,
      );

      await this.transaction.upsert(distributionDocRef, {
        parentId: airdrop.token,
        totalUnclaimedAirdrop: database().inc(airdrop.count),
      });
      const docRef = database().doc(COL.AIRDROP, airdrop.uid);
      await this.transaction.update(docRef, { status: TokenDropStatus.UNCLAIMED });
    }

    this.transactionService.markAsReconciled(order, match.msgId);

    this.transactionService.push({
      ref: database().doc(COL.TRANSACTION, order.uid),
      data: { payload_amount: tranEntry.amount },
      action: Action.U,
    });
  };
}
