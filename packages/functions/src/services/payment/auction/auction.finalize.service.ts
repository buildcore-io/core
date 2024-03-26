import { ITransaction, build5Db } from '@build-5/database';
import {
  Auction,
  AuctionType,
  COL,
  Member,
  Nft,
  NftStatus,
  Transaction,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import { invalidArgument } from '../../../utils/error.utils';
import { NotificationService } from '../../notification/notification';
import { BaseNftService } from '../nft/common';
import { Action, TransactionService } from '../transaction-service';

export class AuctionFinalizeService {
  private transaction: ITransaction;
  constructor(readonly transactionService: TransactionService) {
    this.transaction = transactionService.transaction;
  }

  public markAsFinalized = async (auctionId: string) => {
    const auctionDocRef = build5Db().doc(COL.AUCTION, auctionId);
    const auction = <Auction>await this.transaction.get(auctionDocRef);
    if (!auction.active) {
      throw invalidArgument(WenError.auction_not_active);
    }

    this.transactionService.push({ ref: auctionDocRef, data: { active: false }, action: Action.U });

    const payments = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.PAYMENT)
      .where('payload_invalidPayment', '==', false)
      .where('payload_auction', '==', auction.uid)
      .get();
    for (const payment of payments) {
      const orderDocRef = build5Db().doc(COL.TRANSACTION, payment.payload.sourceTransaction![0]);
      const order = <Transaction>await orderDocRef.get();
      this.transactionService.createBillPayment(order, payment);
    }

    switch (auction.type) {
      case AuctionType.NFT:
        await this.finalizeNftAuction(auction);
    }
  };

  private finalizeNftAuction = async (auction: Auction) => {
    const nftDocRef = build5Db().doc(COL.NFT, auction.nftId!);
    const nft = <Nft>await this.transaction.get(nftDocRef);

    if (!auction.auctionHighestBidder) {
      this.transactionService.push({
        ref: nftDocRef,
        data: {
          auctionFrom: null,
          auctionTo: null,
          extendedAuctionTo: null,
          auctionFloorPrice: null,
          auctionLength: null,
          extendedAuctionLength: null,
          auctionHighestBid: null,
          auctionHighestBidder: null,
          auction: null,
        },
        action: Action.U,
      });
      return;
    }

    const orderDocRef = build5Db().doc(COL.TRANSACTION, auction.bids[0].order);
    const order = <Transaction>await orderDocRef.get();

    const nftService = new BaseNftService(this.transactionService);
    await nftService.setNftOwner(order, auction.auctionHighestBid!);

    const memberDocRef = build5Db().collection(COL.MEMBER).doc(order!.member!);
    const member = <Member>await memberDocRef.get();

    const notification = NotificationService.prepareWinBid(
      member,
      auction.auctionHighestBid!,
      auction.uid,
    );
    this.transactionService.push({
      ref: build5Db().doc(COL.NOTIFICATION, notification.uid),
      data: notification,
      action: Action.C,
    });

    nftService.setTradingStats(nft);

    const tanglePuchase = order.payload.tanglePuchase;
    const disableWithdraw = order.payload.disableWithdraw;
    if (!disableWithdraw && tanglePuchase && nft.status === NftStatus.MINTED) {
      await nftService.withdrawNft(order, nft);
    }
  };
}
