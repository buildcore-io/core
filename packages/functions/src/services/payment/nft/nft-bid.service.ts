import { build5Db } from '@build-5/database';
import { COL, Member, Nft, NftStatus, Transaction } from '@build-5/interfaces';
import { last } from 'lodash';
import { NotificationService } from '../../notification/notification';
import { HandlerParams } from '../base';
import { BaseNftService } from './common';

export class NftBidService extends BaseNftService {
  public handleRequest = async ({ order, match, tran, tranEntry, build5Tran }: HandlerParams) => {
    const nftDocRef = build5Db().collection(COL.NFT).doc(order.payload.nft!);
    const nft = await this.transactionService.get<Nft>(nftDocRef);
    if (nft?.auctionFrom) {
      const payment = await this.transactionService.createPayment(order, match);
      await this.addNewBid(order, payment);
    } else {
      await this.transactionService.processAsInvalid(tran, order, tranEntry, build5Tran);
    }
  };

  public async markNftAsFinalized({ uid, auctionFrom }: Nft): Promise<void> {
    if (!auctionFrom) {
      throw new Error('NFT auctionFrom is no longer defined');
    }

    const nftDocRef = build5Db().doc(`${COL.NFT}/${uid}`);
    const nft = <Nft>await this.transactionService.get(nftDocRef);
    if (nft.auctionHighestTransaction) {
      const highestPayDocRef = build5Db().doc(
        `${COL.TRANSACTION}/${nft.auctionHighestTransaction}`,
      );
      const highestPay = (await highestPayDocRef.get<Transaction>())!;

      const orderId = Array.isArray(highestPay.payload.sourceTransaction)
        ? last(highestPay.payload.sourceTransaction)!
        : highestPay.payload.sourceTransaction!;
      const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${orderId}`);
      const order = await orderDocRef.get<Transaction>();
      if (!order) {
        throw new Error('Unable to find ORDER linked to PAYMENT');
      }

      this.transactionService.markAsReconciled(order, highestPay.payload.chainReference!);
      this.transactionService.createBillPayment(order, highestPay);
      await this.setNftOwner(order, highestPay);

      const memberDocRef = build5Db().collection(COL.MEMBER).doc(order.member!);
      const member = <Member>await memberDocRef.get();

      const notification = NotificationService.prepareWinBid(member, nft, highestPay);
      const notificationDocRef = build5Db().doc(`${COL.NOTIFICATION}/${notification.uid}`);
      this.transactionService.push({
        ref: notificationDocRef,
        data: notification,
        action: 'set',
      });
      this.transactionService.push({
        ref: orderDocRef,
        data: {
          linkedTransactions: build5Db().arrayUnion(...this.transactionService.linkedTransactions),
        },
        action: 'update',
      });

      this.setTradingStats(nft);

      const tanglePuchase = order.payload.tanglePuchase;
      const disableWithdraw = order.payload.disableWithdraw;
      if (!disableWithdraw && tanglePuchase && nft.status === NftStatus.MINTED) {
        await this.withdrawNft(order, nft);
      }
    } else {
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
          auctionHighestTransaction: null,
        },
        action: 'update',
      });
    }
  }
}
