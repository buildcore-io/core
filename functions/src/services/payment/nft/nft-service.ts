import dayjs from 'dayjs';
import { isEmpty, last } from 'lodash';
import { Member, Transaction, TransactionOrder } from '../../../../interfaces/models';
import { COL } from '../../../../interfaces/models/base';
import { MilestoneTransaction, MilestoneTransactionEntry } from '../../../../interfaces/models/milestone';
import { Nft, NftAccess, NftStatus } from '../../../../interfaces/models/nft';
import { Notification } from "../../../../interfaces/models/notification";
import { OrderTransaction, PaymentTransaction, TransactionOrderType, TransactionPayment } from '../../../../interfaces/models/transaction';
import admin from '../../../admin.config';
import { getNftMetadata } from '../../../utils/collection-minting-utils/nft.utils';
import { OrderPayBillCreditTransaction } from '../../../utils/common.utils';
import { dateToTimestamp, serverTime } from "../../../utils/dateTime.utils";
import { NotificationService } from '../../notification/notification';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class NftService {
  constructor(readonly transactionService: TransactionService) { }

  public async handleNftPurchaseRequest(tran: MilestoneTransaction, tranOutput: MilestoneTransactionEntry, order: TransactionOrder, match: TransactionMatch) {
    const refNft = admin.firestore().collection(COL.NFT).doc(order.payload.nft!);
    const sfDocNft = await this.transactionService.transaction.get(refNft);
    if (sfDocNft.data()?.availableFrom !== null) {
      // Found transaction, create payment / ( bill payments | credit)
      const payment = this.transactionService.createPayment(order, match);
      this.transactionService.createBillPayment(order, payment);
      await this.setNftOwner(order, payment);
      await this.transactionService.markAsReconciled(order, match.msgId);
    } else {
      // NFT has been purchased by someone else.
      this.transactionService.processAsInvalid(tran, order, tranOutput);
    }
  }

  public async handleNftBidRequest(tran: MilestoneTransaction, tranOutput: MilestoneTransactionEntry, order: TransactionOrder, match: TransactionMatch) {
    const refNft = admin.firestore().collection(COL.NFT).doc(order.payload.nft!);
    const sfDocNft = await this.transactionService.transaction.get(refNft);
    if (sfDocNft.data()?.auctionFrom !== null) {
      const payment = this.transactionService.createPayment(order, match);
      await this.addNewBid(order, payment);
    } else {
      // Auction is no longer available.
      this.transactionService.processAsInvalid(tran, order, tranOutput);
    }
  }

  public async markNftAsFinalized(nft: Nft): Promise<void> {
    if (!nft.auctionFrom) {
      throw new Error('NFT auctionFrom is no longer defined');
    }

    const refSource = admin.firestore().collection(COL.NFT).doc(nft.uid);
    const sfDocNft = await this.transactionService.transaction.get(refSource);
    if (sfDocNft.data()?.auctionHighestTransaction) {
      const previousHighestPayRef = admin.firestore().collection(COL.TRANSACTION).doc(sfDocNft.data()?.auctionHighestTransaction);
      const previousHighestPayDoc = await this.transactionService.transaction.get(previousHighestPayRef);

      // It has been succesfull, let's finalise.
      const pay: TransactionPayment = <TransactionPayment>previousHighestPayDoc.data();

      // Let's get the actual order.
      const sourcTran: string = Array.isArray(pay.payload.sourceTransaction) ? last(pay.payload.sourceTransaction)! : pay.payload.sourceTransaction!;
      const refOrder = admin.firestore().collection(COL.TRANSACTION).doc(sourcTran);
      const sfDocOrder = await this.transactionService.transaction.get(refOrder);
      const data = <Transaction | undefined>sfDocOrder.data()
      if (!data) {
        throw new Error('Unable to find ORDER linked to PAYMENT');
      }

      await this.transactionService.markAsReconciled(data, pay.payload.chainReference);
      this.transactionService.createBillPayment(data, pay);
      await this.setNftOwner(data, pay);

      const refMember = admin.firestore().collection(COL.MEMBER).doc(data.member!);
      const sfDocMember = await this.transactionService.transaction.get(refMember);
      const bidNotification = NotificationService.prepareWinBid(<Member>sfDocMember.data(), nft, pay);
      const refNotification = admin.firestore().collection(COL.NOTIFICATION).doc(bidNotification.uid);
      this.transactionService.updates.push({ ref: refNotification, data: bidNotification, action: 'set' });

      // Update links
      const refOrderDoc = await this.transactionService.transaction.get(refOrder);
      const refOrderDocData = refOrderDoc.data()
      if (refOrderDocData) {
        this.transactionService.updates.push({
          ref: refOrder,
          data: {
            linkedTransactions: [...(refOrderDocData.linkedTransactions || []), ...this.transactionService.linkedTransactions]
          },
          action: 'update'
        });
      }
    } else {
      // Remove auction from THE NFT!
      this.transactionService.updates.push({
        ref: refSource,
        data: {
          auctionFrom: null,
          auctionTo: null,
          auctionFloorPrice: null,
          auctionLength: null,
          auctionHighestBid: null,
          auctionHighestBidder: null,
          auctionHighestTransaction: null
        },
        action: 'update'
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
        const payload = <OrderPayBillCreditTransaction>data.payload
        payload.void = true;
        this.transactionService.updates.push({ ref: refSource, data: data, action: 'update' });

        // Unlock NFT.
        const refNft = admin.firestore().collection(COL.NFT).doc(transaction.payload.nft);
        this.transactionService.updates.push({ ref: refNft, data: { locked: false, lockedBy: null }, action: 'update' });
      } else if (transaction.payload.type === TransactionOrderType.NFT_BID) {
        const payments = await admin.firestore().collection(COL.TRANSACTION)
          .where('payload.invalidPayment', '==', false)
          .where('payload.sourceTransaction', 'array-contains', transaction.uid)
          .orderBy('payload.amount', 'desc')
          .get();
        if (payments.size === 0) {
          // No orders, we just void.
          const data = <Transaction>sfDoc.data();
          const payload = <OrderPayBillCreditTransaction>data.payload
          payload.void = true;
          this.transactionService.updates.push({ ref: refSource, data: data, action: 'update' });
        }
      }
    } else {
      const data = <Transaction>sfDoc.data();
      const payload = <OrderPayBillCreditTransaction>data.payload
      payload.void = true;
      this.transactionService.updates.push({ ref: refSource, data, action: 'update' });
    }
  }

  private async addNewBid(transaction: Transaction, payment: Transaction): Promise<void> {
    const refNft = admin.firestore().collection(COL.NFT).doc(transaction.payload.nft);
    const refPayment = admin.firestore().collection(COL.TRANSACTION).doc(payment.uid);
    const sfDocNft = await this.transactionService.transaction.get(refNft);
    let newValidPayment = false;
    let previousHighestPay: TransactionPayment | undefined;
    const paymentPayload = <PaymentTransaction>payment.payload
    if (sfDocNft.data()?.auctionHighestTransaction) {
      const previousHighestPayRef = admin.firestore().collection(COL.TRANSACTION).doc(sfDocNft.data()?.auctionHighestTransaction);
      const previousHighestPayDoc = await this.transactionService.transaction.get(previousHighestPayRef);

      // It has been successful, let's finalize.
      previousHighestPay = <TransactionPayment>previousHighestPayDoc.data();
      if (
        previousHighestPay.payload.amount < paymentPayload.amount &&
        paymentPayload.amount >= sfDocNft.data()?.auctionFloorPrice
      ) {
        newValidPayment = true;
      }
    } else {
      if (paymentPayload.amount >= sfDocNft.data()?.auctionFloorPrice) {
        newValidPayment = true;
      }
    }

    // We need to credit the old payment.
    if (newValidPayment && previousHighestPay) {
      const refPrevPayment = admin.firestore().collection(COL.TRANSACTION).doc(previousHighestPay.uid);
      previousHighestPay.payload.invalidPayment = true;
      this.transactionService.updates.push({ ref: refPrevPayment, data: previousHighestPay, action: 'update' });

      // Mark as invalid and create credit.
      const sameOwner = previousHighestPay.member === transaction.member;
      const credit = this.transactionService.createCredit(previousHighestPay, {
        msgId: previousHighestPay.payload.chainReference,
        to: {
          address: previousHighestPay.payload.targetAddress,
          amount: previousHighestPay.payload.amount
        },
        from: {
          address: previousHighestPay.payload.sourceAddress,
          amount: previousHighestPay.payload.amount
        }
      }, dateToTimestamp(dayjs(payment.createdOn?.toDate()).subtract(1, 's')), sameOwner);

      // We have to set link on the past order.
      if (!sameOwner) {
        const sourcTran: string = Array.isArray(previousHighestPay.payload.sourceTransaction) ? last(previousHighestPay.payload.sourceTransaction)! : previousHighestPay.payload.sourceTransaction!;
        const refHighTranOrder = admin.firestore().collection(COL.TRANSACTION).doc(sourcTran);
        const refHighTranOrderDoc = await this.transactionService.transaction.get(refHighTranOrder);
        if (refHighTranOrderDoc.data()) {
          this.transactionService.updates.push({
            ref: refHighTranOrder,
            data: {
              linkedTransactions: [...(refHighTranOrderDoc.data()?.linkedTransactions || []), ...[credit?.uid]]
            },
            action: 'update'
          });

          // Notify them.
          const refMember = admin.firestore().collection(COL.MEMBER).doc(refHighTranOrderDoc.data()?.member!);
          const sfDocMember = await this.transactionService.transaction.get(refMember);
          const bidNotification: Notification = NotificationService.prepareLostBid(<Member>sfDocMember.data(), <Nft>sfDocNft.data(), previousHighestPay);
          const refNotification = admin.firestore().collection(COL.NOTIFICATION).doc(bidNotification.uid);
          this.transactionService.updates.push({ ref: refNotification, data: bidNotification, action: 'set' });
        }
      }
    }

    // Update NFT with highest bid.
    if (newValidPayment) {
      this.transactionService.updates.push({
        ref: refNft,
        data: {
          auctionHighestBid: (<OrderPayBillCreditTransaction>payment.payload).amount,
          auctionHighestBidder: payment.member,
          auctionHighestTransaction: payment.uid,
        },
        action: 'update'
      });

      const refMember = admin.firestore().collection(COL.MEMBER).doc(transaction.member!);
      const sfDocMember = await this.transactionService.transaction.get(refMember);
      const bidNotification = NotificationService.prepareBid(<Member>sfDocMember.data(), <Nft>sfDocNft.data(), payment);
      const refNotification = admin.firestore().collection(COL.NOTIFICATION).doc(bidNotification.uid);
      this.transactionService.updates.push({ ref: refNotification, data: bidNotification, action: 'set' });
    } else {
      // Invalidate payment.
      paymentPayload.invalidPayment = true;
      this.transactionService.updates.push({ ref: refPayment, data: payment, action: 'update' });

      // No valid payment so we credit anyways.
      this.transactionService.createCredit(payment, {
        msgId: paymentPayload.chainReference,
        to: {
          address: paymentPayload.targetAddress,
          amount: paymentPayload.amount
        },
        from: {
          address: paymentPayload.sourceAddress,
          amount: paymentPayload.amount
        }
      });
    }
  }

  private async setNftOwner(transaction: Transaction, payment: Transaction): Promise<void> {
    if (payment.member) {
      const paymentPayload = <PaymentTransaction>payment.payload
      const refSource = admin.firestore().collection(COL.NFT).doc(paymentPayload.nft!);
      const sfDoc = await this.transactionService.transaction.get(refSource);
      if (sfDoc.data()) {
        this.transactionService.updates.push({
          ref: refSource,
          data: {
            owner: payment.member,
            // If it's to specific member price stays the same.
            price: sfDoc.data()?.saleAccess === NftAccess.MEMBERS ? sfDoc.data()?.price : paymentPayload.amount,
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
          action: 'update'
        });

        if (sfDoc.data()?.auctionHighestTransaction && (<OrderTransaction>transaction.payload).type === TransactionOrderType.NFT_PURCHASE) {
          const refHighTran = admin.firestore().collection(COL.TRANSACTION).doc(sfDoc.data()?.auctionHighestTransaction);
          const refHighTranDoc = await this.transactionService.transaction.get(refHighTran);
          if (refHighTranDoc.data()) {
            const highestPay: TransactionPayment = <TransactionPayment>refHighTranDoc.data();
            highestPay.payload.invalidPayment = true;
            this.transactionService.updates.push({ ref: refHighTran, data: highestPay, action: 'update' });

            // Mark as invalid and create credit.
            const sameOwner = highestPay.member === transaction.member;
            const credit = this.transactionService.createCredit(highestPay, {
              msgId: highestPay.payload.chainReference,
              to: {
                address: highestPay.payload.targetAddress,
                amount: highestPay.payload.amount
              },
              from: {
                address: highestPay.payload.sourceAddress,
                amount: highestPay.payload.amount
              }
            }, serverTime(), sameOwner);
            // We have to set link on the past order.
            if (!sameOwner) {
              const sourcTran: string = Array.isArray(highestPay.payload.sourceTransaction) ? last(highestPay.payload.sourceTransaction)! : highestPay.payload.sourceTransaction!;
              const refHighTranOrder = admin.firestore().collection(COL.TRANSACTION).doc(sourcTran);
              const refHighTranOrderDoc = await this.transactionService.transaction.get(refHighTranOrder);
              if (refHighTranOrderDoc.data()) {
                this.transactionService.updates.push({
                  ref: refHighTranOrder,
                  data: {
                    linkedTransactions: [...(refHighTranOrderDoc.data()?.linkedTransactions || []), ...[credit?.uid]]
                  },
                  action: 'update'
                });
              }
            }
          }
        }
      }

      // If it's first sale we have to update collection.
      if ((<OrderTransaction>transaction.payload).beneficiary === 'space') {
        const refCol = admin.firestore().collection(COL.COLLECTION).doc(paymentPayload.collection!);
        const col = await this.transactionService.transaction.get(refCol);
        this.transactionService.updates.push({ ref: refCol, data: { sold: admin.firestore.FieldValue.increment(1) }, action: 'update' });

        // Let's validate if collection has pending item to sell.
        if (col.data()?.placeholderNft && col.data()?.total === (col.data()?.sold + 1)) {
          const refSource = admin.firestore().collection(COL.NFT).doc(col.data()?.placeholderNft);
          const sfDoc = await this.transactionService.transaction.get(refSource);
          if (sfDoc.data()) {
            this.transactionService.updates.push({
              ref: refSource,
              data: {
                sold: true,
                owner: null,
                availableFrom: null,
                soldOn: serverTime(),
                hidden: false
              },
              action: 'update'
            });
          }
        }
      }
    }
  }

  public depositNft = async (order: Transaction, milestoneTransaction: MilestoneTransactionEntry, match: TransactionMatch) => {
    const payment = this.transactionService.createPayment(order, match);
    const metadata = getNftMetadata(milestoneTransaction.nftOutput)
    const isValid = await this.isValidMetadata(metadata)
    if (!isValid) {
      this.transactionService.createNftCredit(payment, match)
      return
    }

    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${metadata.uid}`)
    await this.transactionService.markAsReconciled(order, match.msgId)
    const data = {
      status: NftStatus.MINTED,
      mintingData: {
        mintedBy: order.member,
        mintedOn: serverTime(),
        network: order.network,
        address: order.payload.targetAddress,
        storageDeposit: milestoneTransaction.amount
      },
      hidden: false
    }
    this.transactionService.updates.push({ ref: nftDocRef, data, action: 'update' })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isValidMetadata = async (metadata: any) => {
    if (isEmpty(metadata.uid)) {
      return false
    }
    const nftDocRef = await admin.firestore().doc(`${COL.NFT}/${metadata.uid}`).get()
    if (!nftDocRef.exists) {
      return false;
    }
    return true
  }
}


