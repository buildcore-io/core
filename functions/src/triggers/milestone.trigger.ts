import dayjs from 'dayjs';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Change } from "firebase-functions";
import { DocumentSnapshot } from "firebase-functions/v1/firestore";
import { Transaction, TransactionOrder, TRANSACTION_AUTO_EXPIRY_MS } from '../../interfaces/models';
import { COL } from '../../interfaces/models/base';
import { MIN_AMOUNT_TO_TRANSFER } from '../services/wallet/wallet';
import { serverTime } from "../utils/dateTime.utils";
import { getRandomEthAddress } from "../utils/wallet.utils";
import { EthAddress, IotaAddress } from './../../interfaces/models/base';
import { MilestoneTransaction, MilestoneTransactionEntry } from './../../interfaces/models/milestone';
import { TransactionOrderType, TransactionType } from './../../interfaces/models/transaction';

interface TransactionMatch {
  msgId: string;
  from: MilestoneTransactionEntry;
  to: MilestoneTransactionEntry;
}

// Listen for changes in all documents in the 'users' collection
export const milestoneWrite: functions.CloudFunction<Change<DocumentSnapshot>> = functions.runWith({
  timeoutSeconds: 300,
  memory: "8GB",
}).firestore.document(COL.MILESTONE + '/{milestoneId}').onWrite(async (change) => {
  const newValue: any = change.after.data();
  const previousValue: any = change.before.data();
  console.log('Milestone triggered');
  if (previousValue?.processed !== true && newValue.completed === true && newValue?.processed !== true) {
    // We need to scan ALL transactions with certain type.
    const transactions: any = await change.after.ref.collection('transactions').get();
    const tranOut: {
      [propName: string]: MilestoneTransaction;
    } = {};
    for (const tran of transactions.docs) {
      tranOut[tran.id] = tran.data();
    }
    if (transactions.size > 0) {
      const service: ProcessingService = new ProcessingService(tranOut);
      await service.processOrders();
      // await service.reconcileBillPayments();
      // await service.reconcileCredits();

      // Now process all invalid orders.
      // Wrong amount, Double payments & Expired orders.
      await service.processInvalidOrders();
    }

    // Mark milestone as processed.
    return change.after.ref.set({
      processed: true
    }, {merge: true});
  } else {
    console.log('Nothing to process.');
    return;
  }
});

class ProcessingService {
  private trans: {
    [propName: string]: MilestoneTransaction;
  };
  private processedTrans: string[] = [];
  constructor(trans: {
    [propName: string]: MilestoneTransaction;
  }) {
    this.trans = trans;
  }

  private getTransactions(type: TransactionType): any {
    return admin.firestore().collection(COL.TRANSACTION).where('type', '==', type).where('payload.reconciled', '==', false).where('payload.void', '==', false).get();
  }

  private findAllOrdersWithAddress(address: IotaAddress): any {
    return admin.firestore().collection(COL.TRANSACTION).where('type', '==', TransactionType.ORDER).where('payload.targetAddress', '==', address).get();
  }

  private findMatch(toAddress: string, amount: number): TransactionMatch | undefined {
    let found: TransactionMatch | undefined;
    for (const [msgId, t] of Object.entries(this.trans)) {
      const fromAddress: MilestoneTransactionEntry = t.inputs[0];
      for (const o of t.outputs) {

        // Ignore output that contains input address. Remaining balance.
        if (t.inputs.find((i) => {
          return o.address === i.address;
        })) {
          continue;
        }

        if (o.address === toAddress && o.amount === amount) {
          found = {
            msgId: msgId,
            from: fromAddress,
            to: o
          };
        }
      }
    }

    return found;
  }

  private actionNotRequired(): boolean {
    return Object.keys(this.trans).length === 0;
  }

  private markAsReconciled(transaction: Transaction, chainRef: string): Promise<any> {
    transaction.payload.reconciled = true;
    transaction.payload.chainReference = chainRef;
    return admin.firestore().collection(COL.TRANSACTION).doc(transaction.uid).update(transaction);
  }

  private async markAsVoid(transaction: TransactionOrder): Promise<void> {
    transaction.payload.void = true;
    await admin.firestore().collection(COL.TRANSACTION).doc(transaction.uid).update(transaction);

    // We need to unlock NFT.
    if (transaction.payload.nft) {
      await admin.firestore().collection(COL.NFT).doc(transaction.payload.nft).update({
        locked: false,
        lockedBy: null
      });
    }
  }

  private async createPayment(order: Transaction, tran: TransactionMatch, invalidPayment = false): Promise<Transaction> {
    if (order.type !== TransactionType.ORDER) {
      throw new Error('Order was not provided as transaction.');
    }

    const tranId: string = getRandomEthAddress();
    const refTran: any = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
    await refTran.set(<Transaction>{
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
    });

    // Update reference on order.
    const refSource: any = admin.firestore().collection(COL.TRANSACTION).doc(order.uid);
    const refData: any = await refSource.get();
    const linkedTransactions: EthAddress[] = refData.data().linkedTransactions || [];
    linkedTransactions.push(tranId);
    await refSource.update({
      linkedTransactions: linkedTransactions
    });

    return (await refTran.get()).data();
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
      royaltyAmt = 0;
      finalAmt = finalAmt + royaltyAmt;
    }

    // Update reference on order.
    const refSource: any = admin.firestore().collection(COL.TRANSACTION).doc(order.uid);
    const refData: any = await refSource.get();
    const linkedTransactions: EthAddress[] = refData.data().linkedTransactions || [];

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
      await refTran.set(data);
      transOut.push((await refTran.get()).data());
      linkedTransactions.push(tranId);
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
          // TODO: Let's give 60s+ to finish above. Maybe we can change it so it wait for fist bill to be reconcile with maximum timeout.
          delay: 60000,
          nft: order.payload.nft || null,
          collection: order.payload.collection || null
        }
      };
      await refTran.set(data);
      transOut.push((await refTran.get()).data());
      linkedTransactions.push(tranId);
    }

    // Update links on the order.
    await refSource.update({
      linkedTransactions: linkedTransactions
    });

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

    // Update reference on order.
    const refSource: any = admin.firestore().collection(COL.TRANSACTION).doc(order.uid);
    const refData: any = await refSource.get();
    const linkedTransactions: EthAddress[] = refData.data().linkedTransactions || [];

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
      await refTran.set(data);
      transOut = (await refTran.get()).data();

      linkedTransactions.push(tranId);

      // Update links on the order.
      await refSource.update({
        linkedTransactions: linkedTransactions
      });
    }

    return transOut;
  }

  private async setValidatedAddress(credit: Transaction, type: 'member'|'space'): Promise<void> {
    if (type === 'member' && credit.member) {
      await admin.firestore().collection(COL.MEMBER).doc(credit.member).update({
        validatedAddress: credit.payload.targetAddress
      });
    } else if (type === 'space' && credit.space) {
      await admin.firestore().collection(COL.SPACE).doc(credit.space).update({
        validatedAddress: credit.payload.targetAddress
      });
    }
  }

  private async setNftOwner(payment: Transaction): Promise<void> {
    if (payment.member) {
      await admin.firestore().collection(COL.NFT).doc(payment.payload.nft).update({
        owner: payment.member,
        sold: true,
        locked: false,
        lockedBy: null,
        hidden: false,
        availableFrom: null
      });

      await admin.firestore().collection(COL.COLLECTION).doc(payment.payload.collection).update({
        sold: admin.firestore.FieldValue.increment(1)
      });

      const col: any = await admin.firestore().collection(COL.COLLECTION).doc(payment.payload.collection).get();

      // Let's validate if collection has pending item to sell.
      if (col.data().placeholderNft && col.data().total === col.data().sold) {
        await admin.firestore().collection(COL.NFT).doc(col.data().placeholderNft).update({
          sold: true,
          hidden: true
        });
      }
    }
  }

  public async processOrders(): Promise<void> {
    console.log('Processing Orders...');
    if (this.actionNotRequired()) {
      return;
    }

    const pendingTrans: any = await this.getTransactions(TransactionType.ORDER);
    for (const pendingTran of pendingTrans.docs) {
      // This happens here on purpose instead of cron to reduce $$$
      const expireDate = dayjs(pendingTran.data().createdOn.toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms');
      if (expireDate.isBefore(dayjs(), 'ms')) {
        await this.markAsVoid(pendingTran.data());
        continue;
      }

      const match: TransactionMatch | undefined = this.findMatch(pendingTran.data().payload.targetAddress, pendingTran.data().payload.amount);
      if (match) {
        this.processedTrans.push(match.to.address);
        // Found transaction, create payment / ( bill payments | credit)
        const payment = await this.createPayment(pendingTran.data(), match);
        if (pendingTran.data().payload.type === TransactionOrderType.NFT_PURCHASE) {
          await this.createBillPayment(pendingTran.data(), match);
          await this.setNftOwner(payment);
        } else if (pendingTran.data().payload.type === TransactionOrderType.SPACE_ADDRESS_VALIDATION) {
          const credit = await this.createCredit(pendingTran.data(), payment, match);
          if (credit) {
            await this.setValidatedAddress(credit, 'space');
          }
        } else if (pendingTran.data().payload.type === TransactionOrderType.MEMBER_ADDRESS_VALIDATION) {
          const credit = await this.createCredit(pendingTran.data(), payment, match);
          if (credit) {
            await this.setValidatedAddress(credit, 'member');
          }
        }

        await this.markAsReconciled(pendingTran.data(), match.msgId);
      }
    }
    return;
  }

  public async processInvalidOrders(): Promise<void> {
    if (this.actionNotRequired()) {
      return;
    }

    // We have to check each output address if there is an order for it.
    for (const [msgId, t] of Object.entries(this.trans)) {
      if (t.outputs?.length) {
        for (const o of t.outputs) {
          // Already processed.
          if (this.processedTrans.indexOf(o.address) > -1) {
            return;
          }

          const orders: any = await this.findAllOrdersWithAddress(o.address);
          if (orders.size > 0) {
            for (const order of orders.docs) {
              const fromAddress: MilestoneTransactionEntry = t.inputs[0];
              // if invalid proceed with credit.
              if (
                order.data().payload.reconciled === true ||
                order.data().payload.void === true ||
                order.data().payload.amount !== o.amount
              ) {
                const wrongTransaction: TransactionMatch = {
                  msgId: msgId,
                  from: fromAddress,
                  to: o
                };
                const payment = await this.createPayment(order.data(), wrongTransaction, true);
                await this.createCredit(order.data(), payment, wrongTransaction);
              }
            }
          }
        }
      }
    }
  }

  public async reconcileBillPayments(): Promise<void> {
    if (this.actionNotRequired()) {
      return;
    }

    const pendingTrans: any = await this.getTransactions(TransactionType.BILL_PAYMENT);
    for (const pendingTran of pendingTrans.docs) {
      const match: TransactionMatch | undefined = this.findMatch(pendingTran.data().payload.targetAddress, pendingTran.data().payload.amount);
      if (match) {
        this.processedTrans.push(match.to.address);
        await this.markAsReconciled(pendingTran.data(), match.msgId);
      }
    }
    return;
  }

  public async reconcileCredits(): Promise<void> {
    if (this.actionNotRequired()) {
      return;
    }

    const pendingTrans: any =  await this.getTransactions(TransactionType.CREDIT);
    for (const pendingTran of pendingTrans.docs) {
      const match: TransactionMatch | undefined = this.findMatch(pendingTran.data().payload.targetAddress, pendingTran.data().payload.amount);
      if (match) {
        this.processedTrans.push(match.to.address);
        await this.markAsReconciled(pendingTran.data(), match.msgId);
      }
    }
    return;
  }

}
