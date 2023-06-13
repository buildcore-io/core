import {
  COL,
  Collection,
  Member,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  Nft,
  NftAccess,
  Notification,
  PaymentTransaction,
  Transaction,
  TransactionCreditType,
  TransactionOrder,
  TransactionOrderType,
  TransactionPayment,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { get, last } from 'lodash';
import { AVAILABLE_NETWORKS } from '../../../controls/common';
import { build5Db } from '../../../firebase/firestore/build5Db';
import { getAddress } from '../../../utils/address.utils';
import { OrderPayBillCreditTransaction } from '../../../utils/common.utils';
import { dateToTimestamp, serverTime } from '../../../utils/dateTime.utils';
import { NotificationService } from '../../notification/notification';
import { createNftWithdrawOrder } from '../tangle-service/nft-purchase.service';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class NftService {
  constructor(readonly transactionService: TransactionService) {}

  public async handleNftPurchaseRequest(
    tran: MilestoneTransaction,
    tranOutput: MilestoneTransactionEntry,
    order: TransactionOrder,
    match: TransactionMatch,
    build5Transaction: Transaction | undefined,
  ) {
    const nftDocRef = build5Db().doc(`${COL.NFT}/${order.payload.nft}`);
    const nft = <Nft>await this.transactionService.get(nftDocRef);

    if (nft.availableFrom === null) {
      await this.transactionService.processAsInvalid(tran, order, tranOutput, build5Transaction);
      return;
    }

    const payment = await this.transactionService.createPayment(order, match);
    this.transactionService.createBillPayment(order, payment);
    await this.setNftOwner(order, payment);
    this.transactionService.markAsReconciled(order, match.msgId);

    this.setTradingStats(nft);

    const tanglePuchase = get(order, 'payload.tanglePuchase', false);
    if (tanglePuchase && AVAILABLE_NETWORKS.includes(order.network!)) {
      const membderDocRef = build5Db().doc(`${COL.MEMBER}/${order.member}`);
      const member = <Member>await membderDocRef.get();
      const { order: withdrawOrder, nftUpdateData } = createNftWithdrawOrder(
        nft,
        member.uid,
        getAddress(member, order.network!),
      );
      this.transactionService.push({
        ref: build5Db().doc(`${COL.TRANSACTION}/${withdrawOrder.uid}`),
        data: withdrawOrder,
        action: 'set',
      });
      this.transactionService.push({
        ref: build5Db().doc(`${COL.NFT}/${nft.uid}`),
        data: nftUpdateData,
        action: 'update',
      });
    }
  }

  public async handleNftBidRequest(
    tran: MilestoneTransaction,
    tranOutput: MilestoneTransactionEntry,
    order: TransactionOrder,
    match: TransactionMatch,
    build5Transaction: Transaction | undefined,
  ) {
    const nftDocRef = build5Db().collection(COL.NFT).doc(order.payload.nft!);
    const nft = await this.transactionService.get<Nft>(nftDocRef);
    if (nft?.auctionFrom) {
      const payment = await this.transactionService.createPayment(order, match);
      await this.addNewBid(order, payment);
    } else {
      await this.transactionService.processAsInvalid(tran, order, tranOutput, build5Transaction);
    }
  }

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
      const highestPay = <TransactionPayment>await highestPayDocRef.get();

      const orderId = Array.isArray(highestPay.payload.sourceTransaction)
        ? last(highestPay.payload.sourceTransaction)!
        : highestPay.payload.sourceTransaction!;
      const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${orderId}`);
      const order = <Transaction | undefined>await orderDocRef.get();
      if (!order) {
        throw new Error('Unable to find ORDER linked to PAYMENT');
      }

      this.transactionService.markAsReconciled(order, highestPay.payload.chainReference);
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
    } else {
      this.transactionService.push({
        ref: nftDocRef,
        data: {
          auctionFrom: null,
          auctionTo: null,
          auctionFloorPrice: null,
          auctionLength: null,
          auctionHighestBid: null,
          auctionHighestBidder: null,
          auctionHighestTransaction: null,
        },
        action: 'update',
      });
    }
  }

  public async markAsVoid(transaction: TransactionOrder): Promise<void> {
    const refSource = build5Db().doc(`${COL.TRANSACTION}/${transaction.uid}`);
    const data = (await this.transactionService.get<Transaction>(refSource))!;
    if (transaction.payload.nft) {
      if (transaction.payload.type === TransactionOrderType.NFT_PURCHASE) {
        const payload = <OrderPayBillCreditTransaction>data.payload;
        payload.void = true;
        this.transactionService.push({ ref: refSource, data: data, action: 'update' });

        // Unlock NFT.
        const refNft = build5Db().collection(COL.NFT).doc(transaction.payload.nft);
        this.transactionService.push({
          ref: refNft,
          data: { locked: false, lockedBy: null },
          action: 'update',
        });
      } else if (transaction.payload.type === TransactionOrderType.NFT_BID) {
        const payments = await build5Db()
          .collection(COL.TRANSACTION)
          .where('payload.invalidPayment', '==', false)
          .where('payload.sourceTransaction', 'array-contains', transaction.uid)
          .orderBy('payload.amount', 'desc')
          .get();
        if (payments.length === 0) {
          // No orders, we just void.
          const payload = <OrderPayBillCreditTransaction>data.payload;
          payload.void = true;
          this.transactionService.push({ ref: refSource, data: data, action: 'update' });
        }
      }
    } else {
      const payload = <OrderPayBillCreditTransaction>data.payload;
      payload.void = true;
      this.transactionService.push({ ref: refSource, data, action: 'update' });
    }
  }

  private async addNewBid(transaction: Transaction, payment: Transaction): Promise<void> {
    const nftDocRef = build5Db().collection(COL.NFT).doc(transaction.payload.nft);
    const paymentDocRef = build5Db().doc(`${COL.TRANSACTION}/${payment.uid}`);
    const nft = await this.transactionService.get<Nft>(nftDocRef);
    let newValidPayment = false;
    let previousHighestPay: TransactionPayment | undefined;
    const paymentPayload = <PaymentTransaction>payment.payload;
    if (nft?.auctionHighestTransaction) {
      const previousHighestPayRef = build5Db().doc(
        `${COL.TRANSACTION}/${nft?.auctionHighestTransaction}`,
      );
      previousHighestPay = (await this.transactionService.get<Transaction>(previousHighestPayRef))!;

      if (
        previousHighestPay.payload.amount < paymentPayload.amount &&
        paymentPayload.amount >= (nft?.auctionFloorPrice || 0)
      ) {
        newValidPayment = true;
      }
    } else {
      if (paymentPayload.amount >= (nft?.auctionFloorPrice || 0)) {
        newValidPayment = true;
      }
    }

    // We need to credit the old payment.
    if (newValidPayment && previousHighestPay) {
      const refPrevPayment = build5Db().doc(`${COL.TRANSACTION}/${previousHighestPay.uid}`);
      previousHighestPay.payload.invalidPayment = true;
      this.transactionService.push({
        ref: refPrevPayment,
        data: previousHighestPay,
        action: 'update',
      });

      // Mark as invalid and create credit.
      const sameOwner = previousHighestPay.member === transaction.member;
      const credit = await this.transactionService.createCredit(
        TransactionCreditType.DATA_NO_LONGER_VALID,
        previousHighestPay,
        {
          msgId: previousHighestPay.payload.chainReference,
          to: {
            address: previousHighestPay.payload.targetAddress,
            amount: previousHighestPay.payload.amount,
          },
          from: {
            address: previousHighestPay.payload.sourceAddress,
            amount: previousHighestPay.payload.amount,
          },
        },
        dateToTimestamp(dayjs(payment.createdOn?.toDate()).subtract(1, 's')),
        sameOwner,
      );

      // We have to set link on the past order.
      if (!sameOwner) {
        const sourcTran: string = Array.isArray(previousHighestPay.payload.sourceTransaction)
          ? last(previousHighestPay.payload.sourceTransaction)!
          : previousHighestPay.payload.sourceTransaction!;
        const refHighTranOrderDocRef = build5Db().doc(`${COL.TRANSACTION}/${sourcTran}`);
        const refHighTranOrder = await this.transactionService.get<Transaction>(
          refHighTranOrderDocRef,
        );
        if (refHighTranOrder) {
          this.transactionService.push({
            ref: refHighTranOrderDocRef,
            data: {
              linkedTransactions: [
                ...(refHighTranOrder?.linkedTransactions || []),
                ...[credit?.uid],
              ],
            },
            action: 'update',
          });

          // Notify them.
          const refMember = build5Db().collection(COL.MEMBER).doc(refHighTranOrder?.member!);
          const sfDocMember = await this.transactionService.get<Member>(refMember);
          const bidNotification: Notification = NotificationService.prepareLostBid(
            sfDocMember!,
            nft!,
            previousHighestPay,
          );
          const refNotification = build5Db().collection(COL.NOTIFICATION).doc(bidNotification.uid);
          this.transactionService.push({
            ref: refNotification,
            data: bidNotification,
            action: 'set',
          });
        }
      }
    }

    // Update NFT with highest bid.
    if (newValidPayment) {
      this.transactionService.push({
        ref: nftDocRef,
        data: {
          auctionHighestBid: (<OrderPayBillCreditTransaction>payment.payload).amount,
          auctionHighestBidder: payment.member,
          auctionHighestTransaction: payment.uid,
        },
        action: 'update',
      });

      const refMember = build5Db().collection(COL.MEMBER).doc(transaction.member!);
      const sfDocMember = await this.transactionService.get<Member>(refMember);
      const bidNotification = NotificationService.prepareBid(sfDocMember!, nft!, payment);
      const refNotification = build5Db().collection(COL.NOTIFICATION).doc(bidNotification.uid);
      this.transactionService.push({
        ref: refNotification,
        data: bidNotification,
        action: 'set',
      });
    } else {
      // Invalidate payment.
      paymentPayload.invalidPayment = true;
      this.transactionService.push({ ref: paymentDocRef, data: payment, action: 'update' });

      // No valid payment so we credit anyways.
      await this.transactionService.createCredit(TransactionCreditType.INVALID_PAYMENT, payment, {
        msgId: paymentPayload.chainReference,
        to: {
          address: paymentPayload.targetAddress,
          amount: paymentPayload.amount,
        },
        from: {
          address: paymentPayload.sourceAddress,
          amount: paymentPayload.amount,
        },
      });
    }
  }

  private async setNftOwner(order: Transaction, payment: Transaction): Promise<void> {
    const nftDocRef = build5Db().collection(COL.NFT).doc(payment.payload.nft);
    const nft = <Nft>await this.transactionService.get(nftDocRef);

    const nftUpdateData = {
      owner: payment.member,
      isOwned: true,
      price: nft.saleAccess === NftAccess.MEMBERS ? nft.price : payment.payload.amount,
      sold: true,
      locked: false,
      lockedBy: null,
      hidden: false,
      soldOn: nft.soldOn || serverTime(),
      availableFrom: null,
      availablePrice: null,
      auctionFrom: null,
      auctionTo: null,
      auctionFloorPrice: null,
      auctionLength: null,
      auctionHighestBid: null,
      auctionHighestBidder: null,
      auctionHighestTransaction: null,
      saleAccess: null,
      saleAccessMembers: [],
    };
    this.transactionService.push({
      ref: nftDocRef,
      data: nftUpdateData,
      action: 'update',
    });

    if (nft.auctionHighestTransaction && order.payload.type === TransactionOrderType.NFT_PURCHASE) {
      const highestTranDocRef = build5Db().doc(
        `${COL.TRANSACTION}/${nft.auctionHighestTransaction}`,
      );
      const highestPay = <TransactionPayment>await highestTranDocRef.get();
      this.transactionService.push({
        ref: highestTranDocRef,
        data: { invalidPayment: true },
        action: 'update',
      });

      const sameOwner = highestPay.member === order.member;
      const credit = await this.transactionService.createCredit(
        TransactionCreditType.NONE,
        highestPay,
        {
          msgId: highestPay.payload.chainReference,
          to: {
            address: highestPay.payload.targetAddress,
            amount: highestPay.payload.amount,
          },
          from: {
            address: highestPay.payload.sourceAddress,
            amount: highestPay.payload.amount,
          },
        },
        serverTime(),
        sameOwner,
      );

      if (!sameOwner) {
        const orderId = Array.isArray(highestPay.payload.sourceTransaction)
          ? last(highestPay.payload.sourceTransaction)!
          : highestPay.payload.sourceTransaction!;
        const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${orderId}`);
        this.transactionService.push({
          ref: orderDocRef,
          data: { linkedTransactions: build5Db().arrayUnion(credit?.uid) },
          action: 'update',
        });
      }
    }

    if (order.payload.beneficiary === 'space') {
      const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${payment.payload.collection}`);
      this.transactionService.push({
        ref: collectionDocRef,
        data: { sold: build5Db().inc(1) },
        action: 'update',
      });

      const collection = (await this.transactionService.get<Collection>(collectionDocRef))!;
      if (collection.placeholderNft && collection.total === collection.sold + 1) {
        const placeholderNftDocRef = build5Db().doc(`${COL.NFT}/${collection.placeholderNft}`);
        this.transactionService.push({
          ref: placeholderNftDocRef,
          data: {
            sold: true,
            owner: null,
            availablePrice: null,
            availableFrom: null,
            soldOn: serverTime(),
            hidden: false,
          },
          action: 'update',
        });
      }
    }
  }

  private setTradingStats = (nft: Nft) => {
    const data = { lastTradedOn: serverTime(), totalTrades: build5Db().inc(1) };
    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${nft.collection}`);
    this.transactionService.push({ ref: collectionDocRef, data, action: 'update' });

    const nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
    this.transactionService.push({ ref: nftDocRef, data, action: 'update' });
  };
}
