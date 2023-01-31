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
  TransactionOrder,
  TransactionOrderType,
  TransactionPayment,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { get, last } from 'lodash';
import admin, { arrayUnion, inc } from '../../../admin.config';
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
    soonTransaction: Transaction | undefined,
  ) {
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${order.payload.nft}`);
    const nft = <Nft>(await this.transactionService.transaction.get(nftDocRef)).data();

    if (nft.availableFrom === null) {
      await this.transactionService.processAsInvalid(tran, order, tranOutput, soonTransaction);
      return;
    }

    const payment = this.transactionService.createPayment(order, match);
    this.transactionService.createBillPayment(order, payment);
    await this.setNftOwner(order, payment);
    await this.transactionService.markAsReconciled(order, match.msgId);

    const tanglePuchase = get(order, 'payload.tanglePuchase', false);
    if (tanglePuchase) {
      const membderDocRef = admin.firestore().doc(`${COL.MEMBER}/${order.member}`);
      const member = <Member>(await membderDocRef.get()).data();
      const { order: withdrawOrder, nftUpdateData } = createNftWithdrawOrder(
        nft,
        member.uid,
        getAddress(member, nft.mintingData?.network!),
      );
      this.transactionService.updates.push({
        ref: admin.firestore().doc(`${COL.TRANSACTION}/${withdrawOrder.uid}`),
        data: withdrawOrder,
        action: 'set',
      });
      this.transactionService.updates.push({
        ref: admin.firestore().doc(`${COL.NFT}/${nft.uid}`),
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
    soonTransaction: Transaction | undefined,
  ) {
    const nftDocRef = admin.firestore().collection(COL.NFT).doc(order.payload.nft!);
    const nftDoc = await this.transactionService.transaction.get(nftDocRef);
    if (nftDoc.data()?.auctionFrom) {
      const payment = this.transactionService.createPayment(order, match);
      await this.addNewBid(order, payment);
    } else {
      await this.transactionService.processAsInvalid(tran, order, tranOutput, soonTransaction);
    }
  }

  public async markNftAsFinalized({ uid, auctionFrom }: Nft): Promise<void> {
    if (!auctionFrom) {
      throw new Error('NFT auctionFrom is no longer defined');
    }

    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${uid}`);
    const nft = <Nft>(await this.transactionService.transaction.get(nftDocRef)).data();
    if (nft.auctionHighestTransaction) {
      const highestPayDocRef = admin
        .firestore()
        .doc(`${COL.TRANSACTION}/${nft.auctionHighestTransaction}`);
      const highestPay = <TransactionPayment>(await highestPayDocRef.get()).data();

      const orderId = Array.isArray(highestPay.payload.sourceTransaction)
        ? last(highestPay.payload.sourceTransaction)!
        : highestPay.payload.sourceTransaction!;
      const orderDocRef = admin.firestore().collection(COL.TRANSACTION).doc(orderId);
      const order = <Transaction | undefined>(await orderDocRef.get()).data();
      if (!order) {
        throw new Error('Unable to find ORDER linked to PAYMENT');
      }

      await this.transactionService.markAsReconciled(order, highestPay.payload.chainReference);
      this.transactionService.createBillPayment(order, highestPay);
      await this.setNftOwner(order, highestPay);

      const memberDocRef = admin.firestore().collection(COL.MEMBER).doc(order.member!);
      const member = <Member>(await memberDocRef.get()).data();

      const notification = NotificationService.prepareWinBid(member, nft, highestPay);
      const notificationDocRef = admin.firestore().doc(`${COL.NOTIFICATION}/${notification.uid}`);
      this.transactionService.updates.push({
        ref: notificationDocRef,
        data: notification,
        action: 'set',
      });
      this.transactionService.updates.push({
        ref: orderDocRef,
        data: {
          linkedTransactions: arrayUnion(...this.transactionService.linkedTransactions),
        },
        action: 'update',
      });
    } else {
      this.transactionService.updates.push({
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
    const refSource = admin.firestore().collection(COL.TRANSACTION).doc(transaction.uid);
    const sfDoc = await this.transactionService.transaction.get(refSource);
    if (transaction.payload.nft) {
      if (transaction.payload.type === TransactionOrderType.NFT_PURCHASE) {
        // Mark as void.
        const data = <Transaction>sfDoc.data();
        const payload = <OrderPayBillCreditTransaction>data.payload;
        payload.void = true;
        this.transactionService.updates.push({ ref: refSource, data: data, action: 'update' });

        // Unlock NFT.
        const refNft = admin.firestore().collection(COL.NFT).doc(transaction.payload.nft);
        this.transactionService.updates.push({
          ref: refNft,
          data: { locked: false, lockedBy: null },
          action: 'update',
        });
      } else if (transaction.payload.type === TransactionOrderType.NFT_BID) {
        const payments = await admin
          .firestore()
          .collection(COL.TRANSACTION)
          .where('payload.invalidPayment', '==', false)
          .where('payload.sourceTransaction', 'array-contains', transaction.uid)
          .orderBy('payload.amount', 'desc')
          .get();
        if (payments.size === 0) {
          // No orders, we just void.
          const data = <Transaction>sfDoc.data();
          const payload = <OrderPayBillCreditTransaction>data.payload;
          payload.void = true;
          this.transactionService.updates.push({ ref: refSource, data: data, action: 'update' });
        }
      }
    } else {
      const data = <Transaction>sfDoc.data();
      const payload = <OrderPayBillCreditTransaction>data.payload;
      payload.void = true;
      this.transactionService.updates.push({ ref: refSource, data, action: 'update' });
    }
  }

  private async addNewBid(transaction: Transaction, payment: Transaction): Promise<void> {
    const nftDocRef = admin.firestore().collection(COL.NFT).doc(transaction.payload.nft);
    const paymentDocRef = admin.firestore().collection(COL.TRANSACTION).doc(payment.uid);
    const nftDoc = await this.transactionService.transaction.get(nftDocRef);
    let newValidPayment = false;
    let previousHighestPay: TransactionPayment | undefined;
    const paymentPayload = <PaymentTransaction>payment.payload;
    if (nftDoc.data()?.auctionHighestTransaction) {
      const previousHighestPayRef = admin
        .firestore()
        .collection(COL.TRANSACTION)
        .doc(nftDoc.data()?.auctionHighestTransaction);
      const previousHighestPayDoc = await this.transactionService.transaction.get(
        previousHighestPayRef,
      );

      // It has been successful, let's finalize.
      previousHighestPay = <TransactionPayment>previousHighestPayDoc.data();
      if (
        previousHighestPay.payload.amount < paymentPayload.amount &&
        paymentPayload.amount >= nftDoc.data()?.auctionFloorPrice
      ) {
        newValidPayment = true;
      }
    } else {
      if (paymentPayload.amount >= nftDoc.data()?.auctionFloorPrice) {
        newValidPayment = true;
      }
    }

    // We need to credit the old payment.
    if (newValidPayment && previousHighestPay) {
      const refPrevPayment = admin
        .firestore()
        .collection(COL.TRANSACTION)
        .doc(previousHighestPay.uid);
      previousHighestPay.payload.invalidPayment = true;
      this.transactionService.updates.push({
        ref: refPrevPayment,
        data: previousHighestPay,
        action: 'update',
      });

      // Mark as invalid and create credit.
      const sameOwner = previousHighestPay.member === transaction.member;
      const credit = this.transactionService.createCredit(
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
        const refHighTranOrder = admin.firestore().collection(COL.TRANSACTION).doc(sourcTran);
        const refHighTranOrderDoc = await this.transactionService.transaction.get(refHighTranOrder);
        if (refHighTranOrderDoc.data()) {
          this.transactionService.updates.push({
            ref: refHighTranOrder,
            data: {
              linkedTransactions: [
                ...(refHighTranOrderDoc.data()?.linkedTransactions || []),
                ...[credit?.uid],
              ],
            },
            action: 'update',
          });

          // Notify them.
          const refMember = admin
            .firestore()
            .collection(COL.MEMBER)
            .doc(refHighTranOrderDoc.data()?.member!);
          const sfDocMember = await this.transactionService.transaction.get(refMember);
          const bidNotification: Notification = NotificationService.prepareLostBid(
            <Member>sfDocMember.data(),
            <Nft>nftDoc.data(),
            previousHighestPay,
          );
          const refNotification = admin
            .firestore()
            .collection(COL.NOTIFICATION)
            .doc(bidNotification.uid);
          this.transactionService.updates.push({
            ref: refNotification,
            data: bidNotification,
            action: 'set',
          });
        }
      }
    }

    // Update NFT with highest bid.
    if (newValidPayment) {
      this.transactionService.updates.push({
        ref: nftDocRef,
        data: {
          auctionHighestBid: (<OrderPayBillCreditTransaction>payment.payload).amount,
          auctionHighestBidder: payment.member,
          auctionHighestTransaction: payment.uid,
        },
        action: 'update',
      });

      const refMember = admin.firestore().collection(COL.MEMBER).doc(transaction.member!);
      const sfDocMember = await this.transactionService.transaction.get(refMember);
      const bidNotification = NotificationService.prepareBid(
        <Member>sfDocMember.data(),
        <Nft>nftDoc.data(),
        payment,
      );
      const refNotification = admin
        .firestore()
        .collection(COL.NOTIFICATION)
        .doc(bidNotification.uid);
      this.transactionService.updates.push({
        ref: refNotification,
        data: bidNotification,
        action: 'set',
      });
    } else {
      // Invalidate payment.
      paymentPayload.invalidPayment = true;
      this.transactionService.updates.push({ ref: paymentDocRef, data: payment, action: 'update' });

      // No valid payment so we credit anyways.
      this.transactionService.createCredit(payment, {
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
    const nftDocRef = admin.firestore().collection(COL.NFT).doc(payment.payload.nft);
    const nft = <Nft>(await this.transactionService.transaction.get(nftDocRef)).data();
    this.transactionService.updates.push({
      ref: nftDocRef,
      data: {
        owner: payment.member,
        // If it's to specific member price stays the same.
        price: nft.saleAccess === NftAccess.MEMBERS ? nft.price : payment.payload.amount,
        sold: true,
        locked: false,
        lockedBy: null,
        hidden: false,
        soldOn: serverTime(),
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
      },
      action: 'update',
    });

    if (nft.auctionHighestTransaction && order.payload.type === TransactionOrderType.NFT_PURCHASE) {
      const highestTranDocRef = admin
        .firestore()
        .doc(`${COL.TRANSACTION}/${nft.auctionHighestTransaction}`);
      const highestPay = <TransactionPayment>(await highestTranDocRef.get()).data();
      this.transactionService.updates.push({
        ref: highestTranDocRef,
        data: { invalidPayment: true },
        action: 'update',
      });

      const sameOwner = highestPay.member === order.member;
      const credit = this.transactionService.createCredit(
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
        const orderDocRef = admin.firestore().collection(COL.TRANSACTION).doc(orderId);
        this.transactionService.updates.push({
          ref: orderDocRef,
          data: { linkedTransactions: arrayUnion(credit?.uid) },
          action: 'update',
        });
      }
    }

    if (order.payload.beneficiary === 'space') {
      const collectionDocRef = admin
        .firestore()
        .doc(`${COL.COLLECTION}/${payment.payload.collection}`);
      this.transactionService.updates.push({
        ref: collectionDocRef,
        data: { sold: inc(1) },
        action: 'update',
      });

      const collectionDoc = await this.transactionService.transaction.get(collectionDocRef);
      const collection = <Collection>collectionDoc.data();
      if (collection.placeholderNft && collection.total === collection.sold + 1) {
        const placeholderNftDocRef = admin
          .firestore()
          .doc(`${COL.NFT}/${collection.placeholderNft}`);
        this.transactionService.updates.push({
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
}
