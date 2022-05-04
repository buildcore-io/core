import dayjs from 'dayjs';
import * as admin from 'firebase-admin';
import { last } from 'lodash';
import { MIN_AMOUNT_TO_TRANSFER, ROYALTY_TRANSACTION_DELAY } from '../../../interfaces/config';
import { Member, Transaction, TransactionOrder } from '../../../interfaces/models';
import { COL, IotaAddress, SUB_COL } from '../../../interfaces/models/base';
import { MilestoneTransaction, MilestoneTransactionEntry } from '../../../interfaces/models/milestone';
import { Nft, NftAccess } from '../../../interfaces/models/nft';
import { Notification } from "../../../interfaces/models/notification";
import { BillPaymentTransaction, CreditPaymentTransaction, OrderTransaction, PaymentTransaction, TransactionOrderType, TransactionPayment, TransactionType, TransactionValidationType } from '../../../interfaces/models/transaction';
import { OrderPayBillCreditTransaction } from '../../utils/common.utils';
import { dateToTimestamp, serverTime } from "../../utils/dateTime.utils";
import { getRandomEthAddress } from "../../utils/wallet.utils";
import { NotificationService } from '../notification/notification';

interface TransactionMatch {
  msgId: string;
  from: MilestoneTransactionEntry;
  to: MilestoneTransactionEntry;
}

interface TransactionUpdates {
  ref: admin.firestore.DocumentReference<admin.firestore.DocumentData>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  action: 'update' | 'set';
  merge?: boolean;
}

export class ProcessingService {
  private transaction: FirebaseFirestore.Transaction;
  private linkedTransactions: string[] = [];
  private updates: TransactionUpdates[] = [];
  constructor(transaction: FirebaseFirestore.Transaction) {
    this.transaction = transaction;
  }

  public submit(): void {
    this.updates.forEach((params) => {
      if (params.action === 'set') {
        this.transaction.set(params.ref, params.data, { merge: params.merge || false });
      } else {
        this.transaction.update(params.ref, params.data);
      }
    });
  }

  private findAllOrdersWithAddress = (address: IotaAddress) =>
    admin.firestore().collection(COL.TRANSACTION).where('type', '==', TransactionType.ORDER).where('payload.targetAddress', '==', address).get();


  private isMatch(tran: MilestoneTransaction, toAddress: string, amount: number, validationType: TransactionValidationType): TransactionMatch | undefined {
    let found: TransactionMatch | undefined;
    const fromAddress: MilestoneTransactionEntry = tran.inputs?.[0];
    if (fromAddress && tran.outputs) {
      for (const o of tran.outputs) {

        // Ignore output that contains input address. Remaining balance.
        if (tran.inputs.find((i) => {
          return o.address === i.address;
        })) {
          continue;
        }

        if (o.address === toAddress && (o.amount === amount || validationType === TransactionValidationType.ADDRESS)) {
          found = {
            msgId: tran.messageId,
            from: fromAddress,
            to: o
          };
        }
      }
    }

    return found;
  }

  private async markAsReconciled(transaction: Transaction, chainRef: string) {
    const refSource = admin.firestore().collection(COL.TRANSACTION).doc(transaction.uid);
    const sfDoc = await this.transaction.get(refSource);
    if (sfDoc.data()) {
      const data = <Transaction>sfDoc.data();
      const payload = <PaymentTransaction | BillPaymentTransaction | CreditPaymentTransaction>data.payload
      payload.reconciled = true;
      payload.chainReference = chainRef;
      this.updates.push({
        ref: refSource,
        data: data,
        action: 'update'
      });
    }
  }

  public async markNftAsFinalized(nft: Nft): Promise<void> {
    if (!nft.auctionFrom) {
      throw new Error('NFT auctionFrom is no longer defined');
    }

    const refSource = admin.firestore().collection(COL.NFT).doc(nft.uid);
    const sfDocNft = await this.transaction.get(refSource);
    if (sfDocNft.data()?.auctionHighestTransaction) {
      const previousHighestPayRef = admin.firestore().collection(COL.TRANSACTION).doc(sfDocNft.data()?.auctionHighestTransaction);
      const previousHighestPayDoc = await this.transaction.get(previousHighestPayRef);

      // It has been succesfull, let's finalise.
      const pay: TransactionPayment = <TransactionPayment>previousHighestPayDoc.data();

      // Let's get the actual order.
      const refOrder = admin.firestore().collection(COL.TRANSACTION).doc(last(pay.payload.sourceTransaction)!);
      const sfDocOrder = await this.transaction.get(refOrder);
      const data = <Transaction | undefined>sfDocOrder.data()
      if (!data) {
        throw new Error('Unable to find ORDER linked to PAYMENT');
      }

      await this.markAsReconciled(data, pay.payload.chainReference);
      await this.createBillPayment(data, pay);
      await this.setNftOwner(data, pay);

      const refMember = admin.firestore().collection(COL.MEMBER).doc(data.member!);
      const sfDocMember = await this.transaction.get(refMember);
      const bidNotification: Notification = NotificationService.prepareWinBid(<Member>sfDocMember.data(), nft, pay);
      const refNotification = admin.firestore().collection(COL.NOTIFICATION).doc(bidNotification.uid);
      this.updates.push({
        ref: refNotification,
        data: bidNotification,
        action: 'set'
      });

      // Update links
      const refOrderDoc = await this.transaction.get(refOrder);
      const refOrderDocData = refOrderDoc.data()
      if (refOrderDocData) {
        this.updates.push({
          ref: refOrder,
          data: {
            linkedTransactions: [...(refOrderDocData.linkedTransactions || []), ...this.linkedTransactions]
          },
          action: 'update'
        });
      }
    } else {
      // Remove auction from THE NFT!
      this.updates.push({
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
    const sfDoc = await this.transaction.get(refSource);
    if (transaction.payload.nft) {
      if (transaction.payload.type === TransactionOrderType.NFT_PURCHASE) {
        // Mark as void.
        const data = <Transaction>sfDoc.data();
        const payload = <OrderPayBillCreditTransaction>data.payload
        payload.void = true;
        this.updates.push({
          ref: refSource,
          data: data,
          action: 'update'
        });

        // Unlock NFT.
        const refNft = admin.firestore().collection(COL.NFT).doc(transaction.payload.nft);
        this.updates.push({
          ref: refNft,
          data: {
            locked: false,
            lockedBy: null
          },
          action: 'update'
        });
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
          this.updates.push({
            ref: refSource,
            data: data,
            action: 'update'
          });
        }
      }
    } else {
      const data = <Transaction>sfDoc.data();
      const payload = <OrderPayBillCreditTransaction>data.payload
      payload.void = true;
      this.updates.push({
        ref: refSource,
        data: data,
        action: 'update'
      });
    }
  }

  private async createPayment(order: Transaction, tran: TransactionMatch, invalidPayment = false): Promise<Transaction> {
    if (order.type !== TransactionType.ORDER) {
      throw new Error('Order was not provided as transaction.');
    }

    const tranId: string = getRandomEthAddress();
    const refTran = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
    const tranData: Transaction = <Transaction>{
      type: TransactionType.PAYMENT,
      uid: tranId,
      member: order.member,
      space: order.space,
      createdOn: serverTime(),
      payload: {
        // This must be the amount they send. As we're handing both correct amount from order or invalid one.
        amount: tran.to.amount,
        sourceAddress: tran.from.address,
        targetAddress: order.payload.targetAddress,
        reconciled: true,
        void: false,
        sourceTransaction: [order.uid],
        chainReference: tran.msgId,
        nft: order.payload.nft || null,
        collection: order.payload.collection || null,
        token: order.payload.token || null,
        invalidPayment: invalidPayment
      }
    };

    this.updates.push({
      ref: refTran,
      data: tranData,
      action: 'set'
    });

    this.linkedTransactions.push(tranId);
    return tranData;
  }

  private async createBillPayment(order: Transaction, payment: Transaction): Promise<Transaction[]> {
    if (order.type !== TransactionType.ORDER) {
      throw new Error('Order was not provided as transaction.');
    }
    const orderPayload = <OrderTransaction>order.payload

    // Calculate royalties.
    const transOut: Transaction[] = [];
    let royaltyAmt: number = orderPayload.royaltiesSpaceAddress ? Math.ceil(orderPayload.amount * (orderPayload.royaltiesFee || 0)) : 0;
    let finalAmt: number = (<OrderPayBillCreditTransaction>payment.payload).amount - royaltyAmt;

    if (royaltyAmt < MIN_AMOUNT_TO_TRANSFER) {
      finalAmt = finalAmt + royaltyAmt;
      royaltyAmt = 0;
    }

    if (finalAmt > 0) {
      const tranId: string = getRandomEthAddress();
      const refTran = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
      const data = <Transaction>{
        type: TransactionType.BILL_PAYMENT,
        uid: tranId,
        space: orderPayload.beneficiary !== 'member' ? order.space : null,
        member: order.member,
        createdOn: serverTime(),
        payload: {
          amount: finalAmt,
          sourceAddress: orderPayload.targetAddress,
          previousOwnerEntity: orderPayload.beneficiary,
          previousOwner: orderPayload.beneficiaryUid,
          targetAddress: orderPayload.beneficiaryAddress,
          sourceTransaction: [order.uid],
          nft: orderPayload.nft || null,
          reconciled: true,
          royalty: false,
          void: false,
          collection: orderPayload.collection || null
        }
      };
      this.updates.push({
        ref: refTran,
        data: data,
        action: 'set'
      });
      transOut.push(data);
      this.linkedTransactions.push(tranId);
    }

    // Pay roaylties.
    if (royaltyAmt > 0) {
      const tranId: string = getRandomEthAddress();
      const refTran = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
      const data = <Transaction>{
        type: TransactionType.BILL_PAYMENT,
        uid: tranId,
        member: order.member,
        space: orderPayload.royaltiesSpace,
        createdOn: serverTime(),
        payload: {
          amount: royaltyAmt,
          sourceAddress: orderPayload.targetAddress,
          targetAddress: orderPayload.royaltiesSpaceAddress,
          sourceTransaction: [order.uid],
          previousOwnerEntity: orderPayload.beneficiary,
          previousOwner: orderPayload.beneficiaryUid,
          reconciled: true,
          royalty: true,
          void: false,
          // We delay royalty.
          delay: ROYALTY_TRANSACTION_DELAY,
          nft: orderPayload.nft || null,
          collection: orderPayload.collection || null
        }
      };
      this.updates.push({
        ref: refTran,
        data: data,
        action: 'set'
      });
      transOut.push(data);
      this.linkedTransactions.push(tranId);
    }

    return transOut;
  }

  private async createCredit(payment: Transaction, tran: TransactionMatch, createdOn = serverTime(), setLink = true): Promise<Transaction | undefined> {
    if (payment.type !== TransactionType.PAYMENT) {
      throw new Error('Payment was not provided as transaction.');
    }
    const paymentPayload = payment.payload
    let transOut: Transaction | undefined;
    if (paymentPayload.amount > 0) {
      const tranId: string = getRandomEthAddress();
      const refTran = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
      const data = <Transaction>{
        type: TransactionType.CREDIT,
        uid: tranId,
        space: payment.space,
        member: payment.member,
        createdOn: createdOn,
        payload: {
          amount: paymentPayload.amount,
          sourceAddress: tran.to.address,
          targetAddress: tran.from.address,
          sourceTransaction: [payment.uid],
          nft: paymentPayload.nft || null,
          token: paymentPayload.token || null,
          reconciled: true,
          void: false,
          collection: paymentPayload.collection || null,
          invalidPayment: paymentPayload.invalidPayment
        }
      };
      this.updates.push({
        ref: refTran,
        data: data,
        action: 'set'
      });
      transOut = data;
      if (setLink) {
        this.linkedTransactions.push(tranId);
      }
    }

    return transOut;
  }

  private async setValidatedAddress(credit: Transaction, type: 'member' | 'space'): Promise<void> {
    if (type === 'member' && credit.member) {
      const refSource = admin.firestore().collection(COL.MEMBER).doc(credit.member);
      const sfDoc = await this.transaction.get(refSource);
      if (sfDoc.data()) {
        this.updates.push({
          ref: refSource,
          data: {
            validatedAddress: (<CreditPaymentTransaction>credit.payload).targetAddress
          },
          action: 'update'
        });
      }
    } else if (type === 'space' && credit.space) {
      const refSource = admin.firestore().collection(COL.SPACE).doc(credit.space);
      const sfDoc = await this.transaction.get(refSource);
      if (sfDoc.data()) {
        this.updates.push({
          ref: refSource,
          data: {
            validatedAddress: (<CreditPaymentTransaction>credit.payload).targetAddress
          },
          action: 'update'
        });
      }
    }
  }

  private async addNewBid(transaction: Transaction, payment: Transaction): Promise<void> {
    const refNft = admin.firestore().collection(COL.NFT).doc((<OrderPayBillCreditTransaction>transaction.payload).nft!);
    const refPayment = admin.firestore().collection(COL.TRANSACTION).doc(payment.uid);
    const sfDocNft = await this.transaction.get(refNft);
    let newValidPayment = false;
    let previousHighestPay: TransactionPayment | undefined;
    const paymentPayload = <PaymentTransaction>payment.payload
    if (sfDocNft.data()?.auctionHighestTransaction) {
      const previousHighestPayRef = admin.firestore().collection(COL.TRANSACTION).doc(sfDocNft.data()?.auctionHighestTransaction);
      const previousHighestPayDoc = await this.transaction.get(previousHighestPayRef);

      // It has been succesfull, let's finalise.
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
      this.updates.push({
        ref: refPrevPayment,
        data: previousHighestPay,
        action: 'update'
      });

      // Mark as invalid and create credit.
      const sameOwner: boolean = previousHighestPay.member === transaction.member;
      const credit = await this.createCredit(previousHighestPay, {
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
        const refHighTranOrder = admin.firestore().collection(COL.TRANSACTION).doc(last(previousHighestPay.payload.sourceTransaction)!);
        const refHighTranOrderDoc = await this.transaction.get(refHighTranOrder);
        if (refHighTranOrderDoc.data()) {
          this.updates.push({
            ref: refHighTranOrder,
            data: {
              linkedTransactions: [...(refHighTranOrderDoc.data()?.linkedTransactions || []), ...[credit?.uid]]
            },
            action: 'update'
          });

          // Notify them.
          const refMember = admin.firestore().collection(COL.MEMBER).doc(refHighTranOrderDoc.data()?.member!);
          const sfDocMember = await this.transaction.get(refMember);
          const bidNotification: Notification = NotificationService.prepareLostBid(<Member>sfDocMember.data(), <Nft>sfDocNft.data(), previousHighestPay);
          const refNotification = admin.firestore().collection(COL.NOTIFICATION).doc(bidNotification.uid);
          this.updates.push({
            ref: refNotification,
            data: bidNotification,
            action: 'set'
          });
        }
      }
    }

    // Update NFT with highest bid.
    if (newValidPayment) {
      this.updates.push({
        ref: refNft,
        data: {
          auctionHighestBid: (<OrderPayBillCreditTransaction>payment.payload).amount,
          auctionHighestBidder: payment.member,
          auctionHighestTransaction: payment.uid,
        },
        action: 'update'
      });

      const refMember = admin.firestore().collection(COL.MEMBER).doc(transaction.member!);
      const sfDocMember = await this.transaction.get(refMember);
      const bidNotification = NotificationService.prepareBid(<Member>sfDocMember.data(), <Nft>sfDocNft.data(), payment);
      const refNotification = admin.firestore().collection(COL.NOTIFICATION).doc(bidNotification.uid);
      this.updates.push({
        ref: refNotification,
        data: bidNotification,
        action: 'set'
      });
    } else {
      // Invalidate payment.
      paymentPayload.invalidPayment = true;
      this.updates.push({
        ref: refPayment,
        data: payment,
        action: 'update'
      });

      // No valid payment so we credit anyways.
      await this.createCredit(payment, {
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
      const sfDoc = await this.transaction.get(refSource);
      if (sfDoc.data()) {
        this.updates.push({
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
          const refHighTranDoc = await this.transaction.get(refHighTran);
          if (refHighTranDoc.data()) {
            const highestPay: TransactionPayment = <TransactionPayment>refHighTranDoc.data();
            highestPay.payload.invalidPayment = true;
            this.updates.push({
              ref: refHighTran,
              data: highestPay,
              action: 'update'
            });

            // Mark as invalid and create credit.
            const sameOwner: boolean = highestPay.member === transaction.member;
            const credit = await this.createCredit(highestPay, {
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
              const refHighTranOrder = admin.firestore().collection(COL.TRANSACTION).doc(last(highestPay.payload.sourceTransaction)!);
              const refHighTranOrderDoc = await this.transaction.get(refHighTranOrder);
              if (refHighTranOrderDoc.data()) {
                this.updates.push({
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
        const col = await this.transaction.get(refCol);
        this.updates.push({
          ref: refCol,
          data: {
            sold: admin.firestore.FieldValue.increment(1)
          },
          action: 'update'
        });

        // Let's validate if collection has pending item to sell.
        if (col.data()?.placeholderNft && col.data()?.total === (col.data()?.sold + 1)) {
          const refSource = admin.firestore().collection(COL.NFT).doc(col.data()?.placeholderNft);
          const sfDoc = await this.transaction.get(refSource);
          if (sfDoc.data()) {
            this.updates.push({
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

  private async updateTokenDistribution(order: Transaction, tran: TransactionMatch) {
    const distributionRef = admin.firestore().doc(`${COL.TOKENS}/${order.payload.token}/${SUB_COL.DISTRIBUTION}/${order.member}`)
    const distribution = {
      member: order.member,
      totalDeposit: admin.firestore.FieldValue.increment(tran.to.amount),
      parentId: order.payload.token,
      parentCol: COL.TOKENS
    }
    this.updates.push({
      ref: distributionRef,
      data: distribution,
      action: 'set',
      merge: true
    });
    const tokenRef = admin.firestore().doc(`${COL.TOKENS}/${order.payload.token}`)
    this.updates.push({
      ref: tokenRef,
      data: { totalDeposit: admin.firestore.FieldValue.increment(tran.to.amount) },
      action: 'update'
    });
  }

  private async claimAirdroppedTokens(order: Transaction) {
    await admin.firestore().runTransaction(async (transaction) => {
      const dropDocRef = admin.firestore().doc(`${COL.TOKENS}/${order.payload.token}/${SUB_COL.AIRDROPS}/${order.member}`)
      const dropDoc = await transaction.get(dropDocRef);
      transaction.update(dropDocRef, { tokenClaimed: dropDoc.data()?.tokenDropped })
    })
  }

  public async processMilestoneTransaction(tran: MilestoneTransaction): Promise<void> {
    // We have to check each output address if there is an order for it.
    if (tran.outputs?.length) {
      for (const o of tran.outputs) {
        // Ignore output that contains input address. Remaining balance.
        if (tran.inputs.find((i) => {
          return o.address === i.address;
        })) {
          continue;
        }

        const orders = await this.findAllOrdersWithAddress(o.address);
        if (orders.size > 0) {
          // Technically there should only be one as address is unique per order.
          for (const ord of orders.docs) {
            // Let's read the ORDER so we lock it for read. This is important to avoid concurent processes.
            const orderRef = admin.firestore().collection(COL.TRANSACTION).doc(ord.data().uid);
            const order = await this.transaction.get(orderRef);
            const orderData = <TransactionOrder>order.data()

            if (order.data()) {
              // This happens here on purpose instead of cron to reduce $$$
              const expireDate = dayjs(orderData.payload.expiresOn?.toDate());
              let expired = false;
              if (expireDate.isBefore(dayjs(), 'ms')) {
                await this.markAsVoid(orderData);
                expired = true;
              }

              // Let's process this.'
              const match: TransactionMatch | undefined = this.isMatch(tran, orderData.payload.targetAddress, orderData.payload.amount, orderData.payload.validationType);
              if (
                !expired &&
                orderData.payload.reconciled === false &&
                orderData.payload.void === false &&
                match
              ) {
                if (orderData.payload.type === TransactionOrderType.NFT_PURCHASE) {
                  const refNft = admin.firestore().collection(COL.NFT).doc(orderData.payload.nft!);
                  const sfDocNft = await this.transaction.get(refNft);
                  if (sfDocNft.data()?.availableFrom !== null) {
                    // Found transaction, create payment / ( bill payments | credit)
                    const payment = await this.createPayment(orderData, match);
                    await this.createBillPayment(orderData, payment);
                    await this.setNftOwner(orderData, payment);
                    await this.markAsReconciled(orderData, match.msgId);
                  } else {
                    // NFT has been purchased by someone else.
                    await this.processAsInvalid(tran, orderData, o);
                  }
                } else if (orderData.payload.type === TransactionOrderType.NFT_BID) {
                  const refNft = admin.firestore().collection(COL.NFT).doc(orderData.payload.nft!);
                  const sfDocNft = await this.transaction.get(refNft);
                  if (sfDocNft.data()?.auctionFrom !== null) {
                    const payment = await this.createPayment(orderData, match);
                    await this.addNewBid(orderData, payment);
                  } else {
                    // Auction is no longer available.
                    await this.processAsInvalid(tran, orderData, o);
                  }
                } else if (orderData.payload.type === TransactionOrderType.SPACE_ADDRESS_VALIDATION) {
                  // Found transaction, create payment / ( bill payments | credit)
                  const payment = await this.createPayment(orderData, match);
                  const credit = await this.createCredit(payment, match);
                  if (credit) {
                    await this.setValidatedAddress(credit, 'space');
                  }

                  await this.markAsReconciled(orderData, match.msgId);
                } else if (orderData.payload.type === TransactionOrderType.MEMBER_ADDRESS_VALIDATION) {
                  // Found transaction, create payment / ( bill payments | credit)
                  const payment = await this.createPayment(orderData, match);
                  const credit = await this.createCredit(payment, match);
                  if (credit) {
                    await this.setValidatedAddress(credit, 'member');
                  }

                  await this.markAsReconciled(orderData, match.msgId);
                } else if (orderData.payload.type === TransactionOrderType.TOKEN_PURCHASE) {
                  await this.createPayment(orderData, match);
                  await this.updateTokenDistribution(orderData, match)
                } else if (orderData.payload.type === TransactionOrderType.TOKEN_AIRDROP) {
                  const payment = await this.createPayment(orderData, match);
                  await this.createBillPayment(orderData, payment);
                  await this.markAsReconciled(orderData, match.msgId);
                  await this.claimAirdroppedTokens(orderData);
                }
              } else {
                // Now process all invalid orders.
                // Wrong amount, Double payments & Expired orders.
                await this.processAsInvalid(tran, orderData, o);
              }

              // Add linked transaction.
              this.updates.push({
                ref: orderRef,
                data: {
                  linkedTransactions: [...(orderData.linkedTransactions || []), ...this.linkedTransactions]
                },
                action: 'update'
              });
            }
          }
        }
      }
    }

    return;
  }

  public async processAsInvalid(tran: MilestoneTransaction, order: TransactionOrder, o: MilestoneTransactionEntry): Promise<void> {
    const fromAddress: MilestoneTransactionEntry = tran.inputs?.[0];
    // if invalid proceed with credit.
    if (fromAddress) {
      const wrongTransaction: TransactionMatch = {
        msgId: tran.messageId,
        from: fromAddress,
        to: o
      };
      const payment = await this.createPayment(order, wrongTransaction, true);
      await this.createCredit(payment, wrongTransaction);
    }
  }
}
