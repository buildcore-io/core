import { build5Db } from '@build-5/database';
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
import { TransactionService } from '../transaction-service';

export class AuctionFinalizeService {
  constructor(readonly transactionService: TransactionService) {}

  public markAsFinalized = async (auctionId: string) => {
    const auctionDocRef = build5Db().doc(`${COL.AUCTION}/${auctionId}`);
    const auction = <Auction>await this.transactionService.get(auctionDocRef);
    if (!auction.active) {
      throw invalidArgument(WenError.auction_not_active);
    }

    this.transactionService.push({ ref: auctionDocRef, data: { active: false }, action: 'update' });

    const payments = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.PAYMENT)
      .where('payload.invalidPayment', '==', false)
      .where('payload.auction', '==', auction.uid)
      .get<Transaction>();
    for (const payment of payments) {
      const orderDocRef = build5Db().doc(
        `${COL.TRANSACTION}/${payment.payload.sourceTransaction![0]}`,
      );
      const order = <Transaction>await orderDocRef.get();
      this.transactionService.createBillPayment(order, payment);
    }

    switch (auction.type) {
      case AuctionType.NFT:
        await this.finalizeNftAuction(auction);
    }
  };

  private finalizeNftAuction = async (auction: Auction) => {
    const nftDocRef = build5Db().doc(`${COL.NFT}/${auction.nftId}`);
    const nft = <Nft>await this.transactionService.get(nftDocRef);

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
        action: 'update',
      });
    }

    const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${auction.bids[0].order}`);
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
    const notificationDocRef = build5Db().doc(`${COL.NOTIFICATION}/${notification.uid}`);
    this.transactionService.push({
      ref: notificationDocRef,
      data: notification,
      action: 'set',
    });

    nftService.setTradingStats(nft);

    const tanglePuchase = order.payload.tanglePuchase;
    const disableWithdraw = order.payload.disableWithdraw;
    if (!disableWithdraw && tanglePuchase && nft.status === NftStatus.MINTED) {
      await nftService.withdrawNft(order, nft);
    }
  };
}
