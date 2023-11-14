import { build5Db } from '@build-5/database';
import {
  Auction,
  COL,
  Nft,
  NftStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import { BaseService, HandlerParams } from '../base';
import { BaseNftService } from './common';

export class NftPurchaseService extends BaseService {
  public handleRequest = async ({ order, match, tran, tranEntry, build5Tran }: HandlerParams) => {
    const nftDocRef = build5Db().doc(`${COL.NFT}/${order.payload.nft}`);
    const nft = <Nft>await this.transactionService.get(nftDocRef);

    if (nft.availableFrom === null) {
      await this.transactionService.processAsInvalid(tran, order, tranEntry, build5Tran);
      return;
    }

    const nftService = new BaseNftService(this.transactionService);

    const payment = await this.transactionService.createPayment(order, match);
    this.transactionService.createBillPayment(order, payment);
    await nftService.setNftOwner(order, payment.payload.amount!);

    if (nft.auction) {
      await this.creditBids(nft.auction);
    }

    this.transactionService.markAsReconciled(order, match.msgId);

    nftService.setTradingStats(nft);

    const tanglePuchase = order.payload.tanglePuchase;
    const disableWithdraw = order.payload.disableWithdraw;
    if (!disableWithdraw && tanglePuchase && nft.status === NftStatus.MINTED) {
      await nftService.withdrawNft(order, nft);
    }
  };

  private creditBids = async (auctionId: string) => {
    const auctionDocRef = build5Db().doc(`${COL.AUCTION}/${auctionId}`);
    const auction = <Auction>await this.transaction.get(auctionDocRef);
    this.transactionService.push({
      ref: auctionDocRef,
      data: { active: false },
      action: 'update',
    });

    for (const bid of auction.bids) {
      const payments = await build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.PAYMENT)
        .where('member', '==', bid.bidder)
        .where('payload.invalidPayment', '==', false)
        .where('payload.auction', '==', auctionId)
        .get<Transaction>();
      for (const payment of payments) {
        await this.transactionService.createCredit(TransactionPayloadType.NONE, payment, {
          msgId: payment.payload.chainReference || '',
          to: {
            address: payment.payload.targetAddress!,
            amount: payment.payload.amount!,
          },
          from: payment.payload.sourceAddress!,
        });
      }
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
      } else if (
        [TransactionPayloadType.AUCTION_BID, TransactionPayloadType.NFT_BID].includes(
          transaction.payload.type!,
        )
      ) {
        const payments = await build5Db()
          .collection(COL.TRANSACTION)
          .where('payload.invalidPayment', '==', false)
          .where('payload.sourceTransaction', 'array-contains', transaction.uid)
          .limit(1)
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
