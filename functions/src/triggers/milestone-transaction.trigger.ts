import dayjs from 'dayjs';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Change } from "firebase-functions";
import { DocumentSnapshot } from "firebase-functions/v1/firestore";
import { DEFAULT_TRANSACTION_DELAY, MIN_AMOUNT_TO_TRANSFER } from '../../interfaces/config';
import { Transaction, TransactionOrder, TRANSACTION_AUTO_EXPIRY_MS } from '../../interfaces/models';
import { COL, IotaAddress, SUB_COL } from '../../interfaces/models/base';
import { MilestoneTransaction, MilestoneTransactionEntry } from '../../interfaces/models/milestone';
import { TransactionOrderType, TransactionType } from '../../interfaces/models/transaction';
import { superPump } from '../scale.settings';
import { serverTime } from "../utils/dateTime.utils";
import { getRandomEthAddress } from "../utils/wallet.utils";

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

// Listen for changes in all documents in the 'users' collection
export const milestoneTransactionWrite: functions.CloudFunction<Change<DocumentSnapshot>> = functions.runWith({
  timeoutSeconds: 300,
  minInstances: superPump,
}).firestore.document(COL.MILESTONE + '/{milestoneId}/' + SUB_COL.TRANSACTIONS + '/{tranId}').onWrite(async (change) => {
  const newValue: any = change.after.data();
  console.log('Milestone Transaction triggered');
  if (newValue && newValue?.processed !== true) {

    // We run everything completely inside of the transaction.
    await admin.firestore().runTransaction(async (transaction) => {
      const service: ProcessingService = new ProcessingService(transaction, newValue);
      await service.calculate();

      // This will trigger all update/set.
      service.submit();
    });

    // Mark milestone as processed.
    return change.after.ref.set({
      processed: true,
      processedOn: admin.firestore.Timestamp.now()
    }, {merge: true});
  } else {
    console.log('Nothing to process.');
    return;
  }
});
class ProcessingService {
  private transaction: FirebaseFirestore.Transaction;
  private tran: MilestoneTransaction;
  private linkedTransactions: string[] = [];
  private updates: TransactionUpdates[] = [];
  constructor(transaction: FirebaseFirestore.Transaction, tran: MilestoneTransaction) {
    this.tran = tran;
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

  private isMatch(toAddress: string, amount: number): TransactionMatch | undefined {
    let found: TransactionMatch | undefined;
    const fromAddress: MilestoneTransactionEntry = this.tran.inputs?.[0];
      if (fromAddress && this.tran.outputs) {
        for (const o of this.tran.outputs) {

          // Ignore output that contains input address. Remaining balance.
          if (this.tran.inputs.find((i) => {
            return o.address === i.address;
          })) {
            continue;
          }

          if (o.address === toAddress && o.amount === amount) {
            found = {
              msgId: this.tran.messageId,
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

  private async markAsVoid(transaction: TransactionOrder): Promise<void> {
    const refSource: any = admin.firestore().collection(COL.TRANSACTION).doc(transaction.uid);
    const sfDoc: any = await this.transaction.get(refSource);
    if (sfDoc.data()) {
      const data: any = sfDoc.data();
      data.payload.void = true;
      this.updates.push({
        ref: refSource,
        data: data,
        action: 'update'
      });
    }

    // We need to unlock NFT.
    if (transaction.payload.nft) {
      const refNft: any = await admin.firestore().collection(COL.NFT).doc(transaction.payload.nft);
      const sfDoc: any = await this.transaction.get(refNft);
      if (sfDoc.data()) {
        this.updates.push({
          ref: refNft,
          data: {
            locked: false,
            lockedBy: null
          },
          action: 'update'
        });
      }
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

  private async createBillPayment(order: Transaction, tran: TransactionMatch): Promise<Transaction[]> {
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
          sourceAddress: tran.to.address,
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
          sourceAddress: tran.to.address,
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

  private async setNftOwner(payment: Transaction): Promise<void> {
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
            availableFrom: null
          },
          action: 'update'
        });
      }

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

  public async calculate(): Promise<void> {
    // We have to check each output address if there is an order for it.
    if (this.tran.outputs?.length) {
      for (const o of this.tran.outputs) {
        // Ignore output that contains input address. Remaining balance.
        if (this.tran.inputs.find((i) => {
          return o.address === i.address;
        })) {
          continue;
        }

        const orders: any = await this.findAllOrdersWithAddress(o.address);
        if (orders.size > 0) {
          // Technically there should only be one as address is unique per order.
          for (const order of orders.docs) {
            // This happens here on purpose instead of cron to reduce $$$
            const expireDate = dayjs(order.data().createdOn.toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms');
            let expired = false;
            if (expireDate.isBefore(dayjs(), 'ms')) {
              await this.markAsVoid(order.data());
              expired = true;
            }

            // Let's process this.'
            const match: TransactionMatch | undefined = this.isMatch(order.data().payload.targetAddress, order.data().payload.amount);
            if (
              !expired &&
              order.data().payload.reconciled === false &&
              order.data().payload.void === false &&
              match
            ) {
              // Found transaction, create payment / ( bill payments | credit)
              const payment = await this.createPayment(order.data(), match);
              if (order.data().payload.type === TransactionOrderType.NFT_PURCHASE) {
                await this.createBillPayment(order.data(), match);
                await this.setNftOwner(payment);
              } else if (order.data().payload.type === TransactionOrderType.SPACE_ADDRESS_VALIDATION) {
                const credit = await this.createCredit(order.data(), payment, match);
                if (credit) {
                  await this.setValidatedAddress(credit, 'space');
                }
              } else if (order.data().payload.type === TransactionOrderType.MEMBER_ADDRESS_VALIDATION) {
                const credit = await this.createCredit(order.data(), payment, match);
                if (credit) {
                  await this.setValidatedAddress(credit, 'member');
                }
              }

              await this.markAsReconciled(order.data(), match.msgId);
            } else {
              // Now process all invalid orders.
              // Wrong amount, Double payments & Expired orders.
              await this.processAsInvalid(order.data(), o);
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


  public async processAsInvalid(order: TransactionOrder, o: MilestoneTransactionEntry): Promise<void> {
    const fromAddress: MilestoneTransactionEntry = this.tran.inputs?.[0];
    // if invalid proceed with credit.
    if (fromAddress) {
      const wrongTransaction: TransactionMatch = {
        msgId: this.tran.messageId,
        from: fromAddress,
        to: o
      };
      const payment = await this.createPayment(order, wrongTransaction, true);
      await this.createCredit(order, payment, wrongTransaction);
    }
  }
}
