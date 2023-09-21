import { build5Db } from '@build-5/database';
import { COL, Nft, Transaction, TransactionPayloadType } from '@build-5/interfaces';
import { AVAILABLE_NETWORKS } from '../../../controls/common';
import { HandlerParams } from '../base';
import { BaseNftService } from './common';

export class NftPurchaseService extends BaseNftService {
  public handleRequest = async ({ order, match, tran, tranEntry, build5Tran }: HandlerParams) => {
    const nftDocRef = build5Db().doc(`${COL.NFT}/${order.payload.nft}`);
    const nft = <Nft>await this.transactionService.get(nftDocRef);

    if (nft.availableFrom === null) {
      await this.transactionService.processAsInvalid(tran, order, tranEntry, build5Tran);
      return;
    }

    const payment = await this.transactionService.createPayment(order, match);
    this.transactionService.createBillPayment(order, payment);
    await this.setNftOwner(order, payment);
    this.transactionService.markAsReconciled(order, match.msgId);

    this.setTradingStats(nft);

    const tanglePuchase = order.payload.tanglePuchase;
    const disableWithdraw = order.payload.disableWithdraw;
    if (!disableWithdraw && tanglePuchase && AVAILABLE_NETWORKS.includes(order.network!)) {
      await this.withdrawNft(order, nft);
    }
  };

  public markAsVoid = async (transaction: Transaction): Promise<void> => {
    const refSource = build5Db().doc(`${COL.TRANSACTION}/${transaction.uid}`);
    const data = (await this.transactionService.get<Transaction>(refSource))!;
    if (transaction.payload.nft) {
      if (transaction.payload.type === TransactionPayloadType.NFT_PURCHASE) {
        const payload = data.payload;
        payload.void = true;
        this.transactionService.push({ ref: refSource, data: data, action: 'update' });

        // Unlock NFT.
        const refNft = build5Db().collection(COL.NFT).doc(transaction.payload.nft);
        this.transactionService.push({
          ref: refNft,
          data: { locked: false, lockedBy: null },
          action: 'update',
        });
      } else if (transaction.payload.type === TransactionPayloadType.NFT_BID) {
        const payments = await build5Db()
          .collection(COL.TRANSACTION)
          .where('payload.invalidPayment', '==', false)
          .where('payload.sourceTransaction', 'array-contains', transaction.uid)
          .orderBy('payload.amount', 'desc')
          .get();
        if (payments.length === 0) {
          const payload = data.payload;
          payload.void = true;
          this.transactionService.push({ ref: refSource, data: data, action: 'update' });
        }
      }
    } else {
      const payload = data.payload;
      payload.void = true;
      this.transactionService.push({ ref: refSource, data, action: 'update' });
    }
  };
}
