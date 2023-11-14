import { build5Db } from '@build-5/database';
import {
  Auction,
  AuctionBid,
  AuctionType,
  COL,
  Member,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { head, set } from 'lodash';
import { NotificationService } from '../../notification/notification';
import { HandlerParams } from '../base';
import { TransactionService } from '../transaction-service';

export class AuctionBidService {
  constructor(readonly transactionService: TransactionService) {}

  public handleRequest = async ({
    order,
    match,
    tran,
    tranEntry,
    build5Tran,
    owner,
  }: HandlerParams) => {
    const auctionDocRef = build5Db().doc(`${COL.AUCTION}/${order.payload.auction!}`);
    const auction = <Auction>await this.transactionService.get(auctionDocRef);

    if (!auction.active) {
      await this.transactionService.processAsInvalid(tran, order, tranEntry, build5Tran);
      return;
    }

    this.transactionService.markAsReconciled(order, match.msgId);

    const payment = await this.transactionService.createPayment(order, match);
    await this.addNewBid(owner, auction, order, payment);
  };

  private addNewBid = async (
    owner: string,
    auction: Auction,
    order: Transaction,
    payment: Transaction,
  ): Promise<void> => {
    if (!isValidBid(payment, auction)) {
      await this.creditAsInvalidPayment(payment);
      return;
    }

    const { bids, invalidBid } = placeBid(auction, order.uid, owner, payment.payload.amount!);
    const auctionUpdateData = this.getAuctionUpdateData(auction, bids);

    if (invalidBid) {
      await this.creditInvalidPayments(auction, invalidBid);
    }

    if (auctionUpdateData.auctionHighestBid !== auction.auctionHighestBid) {
      await this.onAuctionHighestBidChange(order, auctionUpdateData);
    }

    if (auction.type === AuctionType.NFT) {
      this.updateNft(auctionUpdateData);
    }
  };

  private creditInvalidPayments = async (auction: Auction, invalidBid: AuctionBid) => {
    const payments = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.PAYMENT)
      .where('member', '==', invalidBid.bidder)
      .where('payload.invalidPayment', '==', false)
      .where('payload.auction', '==', auction.uid)
      .get<Transaction>();
    for (const payment of payments) {
      await this.creditAsInvalidPayment(payment);
    }

    const invalidBidderDocRef = build5Db().doc(`${COL.MEMBER}/${invalidBid.bidder}`);
    const invalidBidder = <Member>await this.transactionService.get(invalidBidderDocRef);

    const notification = NotificationService.prepareLostBid(
      invalidBidder,
      invalidBid.amount,
      auction.uid,
    );
    const notificationDocRef = build5Db().doc(`${COL.NOTIFICATION}/${notification.uid}`);
    this.transactionService.push({ ref: notificationDocRef, data: notification, action: 'set' });
  };

  private creditAsInvalidPayment = async (payment: Transaction) => {
    const paymentDocRef = build5Db().doc(`${COL.TRANSACTION}/${payment.uid}`);
    this.transactionService.push({
      ref: paymentDocRef,
      data: { 'payload.invalidPayment': true },
      action: 'update',
    });
    const paymentPayload = payment.payload;
    set(payment, 'payload.invalidPayment', true);
    await this.transactionService.createCredit(TransactionPayloadType.INVALID_PAYMENT, payment, {
      msgId: paymentPayload.chainReference!,
      to: {
        address: paymentPayload.targetAddress!,
        amount: paymentPayload.amount!,
      },
      from: paymentPayload.sourceAddress!,
    });
    return;
  };

  private onAuctionHighestBidChange = async (order: Transaction, auction: Auction) => {
    const memberDocRef = build5Db().doc(`${COL.MEMBER}/${order.member!}`);
    const member = <Member>await this.transactionService.get(memberDocRef);
    const bidNotification = NotificationService.prepareBid(
      member,
      auction.auctionHighestBid!,
      auction.uid,
    );
    const notificationDocRef = build5Db().doc(`${COL.NOTIFICATION}/${bidNotification.uid}`);
    this.transactionService.push({ ref: notificationDocRef, data: bidNotification, action: 'set' });
  };

  private getAuctionUpdateData = (auction: Auction, bids: AuctionBid[]) => {
    const auctionUpdateData = {
      ...auction,
      bids,
      auctionHighestBidder: head(bids)?.bidder || '',
      auctionHighestBid: head(bids)?.amount || 0,
    };
    const auctionTTL = dayjs(auction.auctionTo!.toDate()).diff(dayjs());
    if (
      auction.auctionLength < (auction.extendedAuctionLength || 0) &&
      auctionTTL < (auction.extendAuctionWithin || 0)
    ) {
      set(auctionUpdateData, 'auctionTo', auction.extendedAuctionTo || null);
      set(auctionUpdateData, 'auctionLength', auction.extendedAuctionLength || null);
    }

    const auctionDocRef = build5Db().doc(`${COL.AUCTION}/${auction.uid}`);
    this.transactionService.push({ ref: auctionDocRef, data: auctionUpdateData, action: 'update' });
    return auctionUpdateData as Auction;
  };

  private updateNft = (auction: Auction) => {
    const nftUpdateData = {
      auctionTo: auction.auctionTo,
      auctionLength: auction.auctionLength,
      auctionHighestBid: auction.auctionHighestBid,
      auctionHighestBidder: auction.auctionHighestBidder,
    };
    this.transactionService.push({
      ref: build5Db().doc(`${COL.NFT}/${auction.nftId}`),
      data: nftUpdateData,
      action: 'update',
    });
  };
}

const isValidBid = (payment: Transaction, auction: Auction) => {
  const amount = payment.payload.amount!;
  const prevBid = auction.bids.find((b) => b.bidder === payment.member);
  const prevBidAmount = prevBid?.amount || 0;

  if (auction.topUpBased) {
    return (
      prevBidAmount + amount >= auction.auctionFloorPrice &&
      amount >= auction.minimalBidIncrement &&
      (prevBid !== undefined || amount > (auction.bids[auction.maxBids - 1]?.amount || 0))
    );
  }

  return (
    amount > (auction.auctionHighestBid || 0) &&
    amount >= auction.auctionFloorPrice &&
    amount - prevBidAmount >= auction.minimalBidIncrement
  );
};

const placeBid = (auction: Auction, order: string, bidder: string, amount: number) => {
  const bids = [...auction.bids];
  const currentBid = bids.find((b) => b.bidder === bidder);

  if (currentBid) {
    if (auction.topUpBased) {
      currentBid.amount += amount;
      bids.sort((a, b) => b.amount - a.amount);
    } else {
      currentBid.amount = Math.max(currentBid.amount, amount);
      bids.sort((a, b) => b.amount - a.amount);
      const invalidBid = { bidder, amount: Math.min(currentBid.amount, amount), order };
      return { bids, invalidBid };
    }
  } else {
    bids.push({ bidder, amount, order });
    bids.sort((a, b) => b.amount - a.amount);
  }

  return {
    bids: bids.slice(0, auction.maxBids),
    invalidBid: head(bids.slice(auction.maxBids)),
  };
};