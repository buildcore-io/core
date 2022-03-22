import dayjs from 'dayjs';
import * as admin from 'firebase-admin';
import { DEFAULT_TRANSACTION_DELAY, MIN_AMOUNT_TO_TRANSFER } from '../../../interfaces/config';
import { Transaction, TransactionOrder } from '../../../interfaces/models';
import { COL, IotaAddress } from '../../../interfaces/models/base';
import { MilestoneTransaction, MilestoneTransactionEntry } from '../../../interfaces/models/milestone';
import { TransactionOrderType, TransactionPayment, TransactionType, TransactionValidationType } from '../../../interfaces/models/transaction';
import { serverTime } from "../../utils/dateTime.utils";
import { getRandomEthAddress } from "../../utils/wallet.utils";

interface TransactionMatch {
  msgId: string;
  from: MilestoneTransactionEntry;
  to: MilestoneTransactionEntry;
}

interface TransactionUpdates {
  ref: any;
  data: any;
  action: 'update'|'set'
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
        this.transaction.set(params.ref, params.data);
      } else {
        this.transaction.update(params.ref, params.data);
      }
    });
  }

  private findAllOrdersWithAddress(address: IotaAddress): any {
    return admin.firestore().collection(COL.TRANSACTION).where('type', '==', TransactionType.ORDER).where('payload.targetAddress', '==', address).get();
  }

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

  private async markAsReconciled(transaction: Transaction, chainRef: string): Promise<any> {
    const refSource: any = admin.firestore().collection(COL.TRANSACTION).doc(transaction.uid);
    const sfDoc: any = await this.transaction.get(refSource);
    if (sfDoc.data()) {
      const data: any = sfDoc.data();
      data.payload.reconciled = true;
      data.payload.chainReference = chainRef;
      this.updates.push({
        ref: refSource,
        data: data,
        action: 'update'
      });
    }
  }

  public async markAsFinalized(transaction: TransactionOrder): Promise<void> {
    const refSource: any = admin.firestore().collection(COL.TRANSACTION).doc(transaction.uid);
    const sfDoc: any = await this.transaction.get(refSource);
    if (transaction.payload.nft) {
      if (transaction.payload.type === TransactionOrderType.NFT_PURCHASE) {
        // Mark as void.
        const data: any = sfDoc.data();
        data.payload.void = true;
        this.updates.push({
          ref: refSource,
          data: data,
          action: 'update'
        });

        // Unlock NFT.
        const refNft: any = await admin.firestore().collection(COL.NFT).doc(transaction.payload.nft);
        this.updates.push({
          ref: refNft,
          data: {
            locked: false,
            lockedBy: null
          },
          action: 'update'
        });
      } else if (transaction.payload.type === TransactionOrderType.NFT_BID) {
        // We need to decide on the winner. Last payment thats not invalid and linked to this order should be the winer.
        const payments: any = await admin.firestore().collection(COL.TRANSACTION)
                              .where('payload.invalidPayment', '==', false)
                              .where('payload.sourceTransaction', '==', transaction.uid).orderBy('payload.amount', 'desc').get();
        if (payments.size > 0) {
          // It has been succesfull, let's finalise.
          const pay: TransactionPayment = <TransactionPayment>payments.docs[0];
          await this.markAsReconciled(transaction, pay.payload.chainReference);
          await this.createBillPayment(transaction);
          await this.setNftOwner(transaction, pay);
        } else {

          // No orders, we just void.
          const data: any = sfDoc.data();
          data.payload.void = true;
          this.updates.push({
            ref: refSource,
            data: data,
            action: 'update'
          });

          // Remove auction from THE NFT!
          const refNft: any = await admin.firestore().collection(COL.NFT).doc(transaction.payload.nft);
          this.updates.push({
            ref: refNft,
            data: {
              auctionFrom: null,
              auctionFloorPrice: null,
              auctionLengthDays: null,
              auctionHighestBid: null
            },
            action: 'update'
          });
        }
      }
    } else {
      const data: any = sfDoc.data();
      data.payload.void = true;
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
    const refTran: any = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
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
        sourceTransaction: order.uid,
        chainReference: tran.msgId,
        nft: order.payload.nft || null,
        collection: order.payload.collection || null,
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

  private async createBillPayment(order: Transaction): Promise<Transaction[]> {
    if (order.type !== TransactionType.ORDER) {
      throw new Error('Order was not provided as transaction.');
    }

    // Calculate royalties.
    const transOut: Transaction[] = [];
    let royaltyAmt: number = order.payload.royaltiesSpaceAddress ? Math.ceil(order.payload.amount * order.payload.royaltiesFee) : 0;
    let finalAmt: number = order.payload.amount - royaltyAmt;

    if (royaltyAmt < MIN_AMOUNT_TO_TRANSFER) {
      finalAmt = finalAmt + royaltyAmt;
      royaltyAmt = 0;
    }

    if (finalAmt > 0) {
      const tranId: string = getRandomEthAddress();
      const refTran: any = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
      const data: any = <Transaction>{
        type: TransactionType.BILL_PAYMENT,
        uid: tranId,
        space: order.payload.beneficiary !== 'member' ? order.space : null,
        member: order.member,
        createdOn: serverTime(),
        payload: {
          amount: finalAmt,
          sourceAddress: order.payload.targetAddress,
          previusOwnerEntity: order.payload.beneficiary,
          previusOwner: order.payload.beneficiaryUid,
          targetAddress: order.payload.beneficiaryAddress,
          sourceTransaction: order.uid,
          nft: order.payload.nft || null,
          reconciled: true,
          royalty: false,
          void: false,
          collection: order.payload.collection || null
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
      const refTran: any = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
      const data: any = <Transaction>{
        type: TransactionType.BILL_PAYMENT,
        uid: tranId,
        member: order.member,
        space: order.payload.royaltiesSpace,
        createdOn: serverTime(),
        payload: {
          amount: royaltyAmt,
          sourceAddress: order.payload.targetAddress,
          targetAddress: order.payload.royaltiesSpaceAddress,
          sourceTransaction: order.uid,
          previusOwnerEntity: order.payload.beneficiary,
          previusOwner: order.payload.beneficiaryUid,
          reconciled: true,
          royalty: true,
          void: false,
          // We delay royalty.
          delay: DEFAULT_TRANSACTION_DELAY,
          nft: order.payload.nft || null,
          collection: order.payload.collection || null
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

  private async createCredit(order: Transaction, payment: Transaction, tran: TransactionMatch): Promise<Transaction|undefined> {
    if (order.type !== TransactionType.ORDER) {
      throw new Error('Order was not provided as transaction.');
    }

    if (payment.type !== TransactionType.PAYMENT) {
      throw new Error('Payment was not provided as transaction.');
    }
    let transOut: Transaction|undefined;
    if (payment.payload.amount > 0) {
      const tranId: string = getRandomEthAddress();
      const refTran: any = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
      const data: any = <Transaction>{
        type: TransactionType.CREDIT,
        uid: tranId,
        space: order.space,
        member: order.member,
        createdOn: serverTime(),
        payload: {
          amount: payment.payload.amount,
          sourceAddress: tran.to.address,
          targetAddress: tran.from.address,
          sourceTransaction: payment.uid,
          nft: order.payload.nft || null,
          reconciled: true,
          void: false,
          collection: order.payload.collection || null,
          invalidPayment: payment.payload.invalidPayment
        }
      };
      this.updates.push({
        ref: refTran,
        data: data,
        action: 'set'
      });
      transOut = data;
      this.linkedTransactions.push(tranId);
    }

    return transOut;
  }

  private async setValidatedAddress(credit: Transaction, type: 'member'|'space'): Promise<void> {
    if (type === 'member' && credit.member) {
      const refSource: any = admin.firestore().collection(COL.MEMBER).doc(credit.member);
      const sfDoc: any = await this.transaction.get(refSource);
      if (sfDoc.data()) {
        this.updates.push({
          ref: refSource,
          data: {
            validatedAddress: credit.payload.targetAddress
          },
          action: 'update'
        });
      }
    } else if (type === 'space' && credit.space) {
      const refSource: any = admin.firestore().collection(COL.SPACE).doc(credit.space);
      const sfDoc: any = await this.transaction.get(refSource);
      if (sfDoc.data()) {
        this.updates.push({
          ref: refSource,
          data: {
            validatedAddress: credit.payload.targetAddress
          },
          action: 'update'
        });
      }
    }
  }

  private async addNewBid(transaction: Transaction, payment: Transaction): Promise<void> {
    const payments: any = await admin.firestore().collection(COL.TRANSACTION)
                          .where('payload.invalidPayment', '==', false)
                          .where('payload.sourceTransaction', '==', transaction.uid).orderBy('payload.amount', 'desc').get();
    let newValidPayment = false;
    let previousHighestPay: TransactionPayment|undefined;
    if (payments.size > 0) {
      // It has been succesfull, let's finalise.
      previousHighestPay = <TransactionPayment>payments.docs[0].data();
      if (previousHighestPay.payload.amount < payment.payload.amount) {
        newValidPayment = true;
      }
    } else {
      newValidPayment = true;
    }

    if (newValidPayment && previousHighestPay) {
      const refPrevPayment: any = admin.firestore().collection(COL.TRANSACTION).doc(previousHighestPay.uid);
      previousHighestPay.payload.invalidPayment = true;
      this.updates.push({
        ref: refPrevPayment,
        data: previousHighestPay,
        action: 'update'
      });

      // Mark as invalid and create credit.
      await this.createCredit(transaction, previousHighestPay, {
        msgId: previousHighestPay.payload.chainReference,
        to: {
          address: previousHighestPay.payload.targetAddress,
          amount: previousHighestPay.payload.amount
        },
        from: {
          address: previousHighestPay.payload.sourceAddress,
          amount: previousHighestPay.payload.amount
        }
      });
    }

    // Update NFT with highest bid.
    // TODO We've to handle if bid goes over buy now / or someone uses BUY NOW!
    if (newValidPayment) {
      const refNft: any = await admin.firestore().collection(COL.NFT).doc(transaction.payload.nft);
      this.updates.push({
        ref: refNft,
        data: {
          auctionHighestBid: payment.payload.amount
        },
        action: 'update'
      });
    }
  }

  private async setNftOwner(transaction: Transaction, payment: Transaction): Promise<void> {
    if (payment.member) {
      const refSource: any = admin.firestore().collection(COL.NFT).doc(payment.payload.nft);
      const sfDoc: any = await this.transaction.get(refSource);
      if (sfDoc.data()) {
        this.updates.push({
          ref: refSource,
          data: {
            owner: payment.member,
            sold: true,
            locked: false,
            lockedBy: null,
            hidden: false,
            soldOn: admin.firestore.Timestamp.now(),
            availableFrom: null,
            availablePrice: null,
            auctionFrom: null,
            auctionFloorPrice: null,
            auctionLengthDays: null,
            auctionHighestBid: null,
            saleAccess: null,
            saleAccessMembers: [],
          },
          action: 'update'
        });
      }

      // If it's first sale we have to update collection.
      if (transaction.payload.beneficiary === 'space') {
        const refCol: any = admin.firestore().collection(COL.COLLECTION).doc(payment.payload.collection);
        const col: any = await this.transaction.get(refCol);
        this.updates.push({
          ref: refCol,
          data: {
            sold: admin.firestore.FieldValue.increment(1)
          },
          action: 'update'
        });

        // Let's validate if collection has pending item to sell.
        if (col.data().placeholderNft && col.data().total === col.data().sold) {
          const refSource: any = admin.firestore().collection(COL.NFT).doc(col.data().placeholderNft);
          const sfDoc: any = await this.transaction.get(refSource);
          if (sfDoc.data()) {
            this.updates.push({
              ref: refSource,
              data: {
                sold: true,
                owner: null,
                availableFrom: null,
                soldOn: admin.firestore.Timestamp.now(),
                hidden: false
              },
              action: 'update'
            });
          }
        }
      }
    }
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

        const orders: any = await this.findAllOrdersWithAddress(o.address);
        if (orders.size > 0) {
          // Technically there should only be one as address is unique per order.
          for (const order of orders.docs) {
            // This happens here on purpose instead of cron to reduce $$$
            const expireDate = dayjs(order.data().payload.expiresOn.toDate());
            let expired = false;
            if (expireDate.isBefore(dayjs(), 'ms')) {
              await this.markAsFinalized(order.data());
              expired = true;
            }

            // Let's process this.'
            const match: TransactionMatch | undefined = this.isMatch(tran, order.data().payload.targetAddress, order.data().payload.amount, order.data().payload.validationType);
            if (
              !expired &&
              order.data().payload.reconciled === false &&
              order.data().payload.void === false &&
              match
            ) {
              if (order.data().payload.type === TransactionOrderType.NFT_PURCHASE) {
                const refNft: any = admin.firestore().collection(COL.NFT).doc(order.data().payload.nft);
                const sfDocNft: any = await this.transaction.get(refNft);
                if (sfDocNft.data().availableFrom !== null) {
                  // Found transaction, create payment / ( bill payments | credit)
                  const payment = await this.createPayment(order.data(), match);
                  await this.createBillPayment(order.data());
                  await this.setNftOwner(order.data(), payment);
                  await this.markAsReconciled(order.data(), match.msgId);
                } else {
                  // NFT has been purchased by someone else.
                  await this.processAsInvalid(tran, order.data(), o);
                }
              } else if (order.data().payload.type === TransactionOrderType.NFT_BID) {
                const refNft: any = admin.firestore().collection(COL.NFT).doc(order.data().payload.nft);
                const sfDocNft: any = await this.transaction.get(refNft);
                if (sfDocNft.data().auctionFrom !== null) {
                  const payment = await this.createPayment(order.data(), match);
                  await this.addNewBid(order.data(), payment);
                } else {
                  // Auction is no longer available.
                  await this.processAsInvalid(tran, order.data(), o);
                }
              } else if (order.data().payload.type === TransactionOrderType.SPACE_ADDRESS_VALIDATION) {
                // Found transaction, create payment / ( bill payments | credit)
                const payment = await this.createPayment(order.data(), match);
                const credit = await this.createCredit(order.data(), payment, match);
                if (credit) {
                  await this.setValidatedAddress(credit, 'space');
                }

                await this.markAsReconciled(order.data(), match.msgId);
              } else if (order.data().payload.type === TransactionOrderType.MEMBER_ADDRESS_VALIDATION) {
                // Found transaction, create payment / ( bill payments | credit)
                const payment = await this.createPayment(order.data(), match);
                const credit = await this.createCredit(order.data(), payment, match);
                if (credit) {
                  await this.setValidatedAddress(credit, 'member');
                }

                await this.markAsReconciled(order.data(), match.msgId);
              }
            } else {
              // Now process all invalid orders.
              // Wrong amount, Double payments & Expired orders.
              await this.processAsInvalid(tran, order.data(), o);
            }

            // Add linked transaction.
            const refSource: any = admin.firestore().collection(COL.TRANSACTION).doc(order.data().uid);
            const sfDoc: any = await this.transaction.get(refSource);
            if (sfDoc.data()) {
              this.updates.push({
                ref: refSource,
                data: {
                  linkedTransactions: [...(sfDoc.data().linkedTransactions || []), ...this.linkedTransactions]
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
      await this.createCredit(order, payment, wrongTransaction);
    }
  }
}
