import { build5Db, getSnapshot } from '@build-5/database';
import {
  COL,
  SUB_COL,
  Token,
  TokenDrop,
  TokenDropStatus,
  TransactionPayloadType,
} from '@build-5/interfaces';
import { get, last } from 'lodash';
import { BaseService, HandlerParams } from '../base';

export class TokenMintedAirdropService extends BaseService {
  public handleRequest = async ({ order, match, tranEntry }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);
    const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${order.payload.token}`);
    const token = <Token>await tokenDocRef.get();
    const tokensSent = (tranEntry.nativeTokens || []).reduce(
      (acc, act) => (act.id === token.mintingData?.tokenId ? acc + Number(act.amount) : acc),
      0,
    );
    const tokensExpected = get(order, 'payload.totalAirdropCount', 0);

    if (tokensSent !== tokensExpected || (tranEntry.nativeTokens || []).length > 1) {
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
      data: { 'payload.amount': tranEntry.amount },
      action: 'update',
    });
  };
}
