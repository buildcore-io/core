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
import { Action } from '../transaction-service';
import { BaseNftService } from './common';

export class NftPurchaseService extends BaseService {
  public handleRequest = async ({ order, match, tran, tranEntry, build5Tran }: HandlerParams) => {
    const nftDocRef = build5Db().doc(COL.NFT, order.payload.nft!);
    const nft = <Nft>await this.transaction.get(nftDocRef);

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

  public creditBids = async (auctionId: string) => {
    const auctionDocRef = build5Db().doc(COL.AUCTION, auctionId);
    const auction = <Auction>await this.transaction.get(auctionDocRef);
    this.transactionService.push({
      ref: auctionDocRef,
      data: { active: false },
      action: Action.U,
    });

    for (const bid of auction.bids) {
      const payments = await build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.PAYMENT)
        .where('member', '==', bid.bidder)
        .where('payload_invalidPayment', '==', false)
        .where('payload_auction', '==', auctionId)
        .get();
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
    const tranDocRef = build5Db().doc(COL.TRANSACTION, transaction.uid);

    const setVoid = () => {
      this.transactionService.push({
        ref: tranDocRef,
        data: { payload_void: true },
        action: Action.U,
      });
    };

    if (transaction.payload.nft) {
      if (transaction.payload.type === TransactionPayloadType.NFT_PURCHASE) {
        setVoid();

        this.transactionService.push({
          ref: build5Db().doc(COL.NFT, transaction.payload.nft),
          data: { locked: false, lockedBy: null },
          action: Action.U,
        });
        return;
      }
      if (
        transaction.payload.type === TransactionPayloadType.AUCTION_BID ||
        transaction.payload.type === TransactionPayloadType.NFT_BID
      ) {
        const payments = await build5Db()
          .collection(COL.TRANSACTION)
          .where('payload_invalidPayment', '==', false)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .where('payload_sourceTransaction', 'array-contains', transaction.uid as any)
          .limit(1)
          .get();
        if (payments.length === 0) {
          setVoid();
        }
      }
    }

    setVoid();
  };
}
