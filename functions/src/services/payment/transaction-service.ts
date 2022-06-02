import { MIN_AMOUNT_TO_TRANSFER, SECONDARY_TRANSACTION_DELAY } from '../../../interfaces/config';
import { Transaction } from '../../../interfaces/models';
import { COL } from '../../../interfaces/models/base';
import { MilestoneTransaction, MilestoneTransactionEntry } from '../../../interfaces/models/milestone';
import { TransactionOrder, TransactionType, TransactionValidationType } from '../../../interfaces/models/transaction';
import admin from '../../admin.config';
import { serverTime } from "../../utils/dateTime.utils";
import { getRandomEthAddress } from "../../utils/wallet.utils";

export interface TransactionMatch {
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

export class TransactionService {
  public readonly linkedTransactions: string[] = [];
  public readonly updates: TransactionUpdates[] = [];

  constructor(public readonly transaction: FirebaseFirestore.Transaction) { }

  public submit(): void {
    this.updates.forEach((params) => {
      if (params.action === 'set') {
        this.transaction.set(params.ref, params.data, { merge: params.merge || false });
      } else {
        this.transaction.update(params.ref, params.data);
      }
    });
  }

  public createPayment(order: Transaction, tran: TransactionMatch, invalidPayment = false): Transaction {
    if (order.type !== TransactionType.ORDER) {
      throw new Error('Order was not provided as transaction.');
    }
    const data: Transaction = <Transaction>{
      type: TransactionType.PAYMENT,
      uid: getRandomEthAddress(),
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
    this.updates.push({ ref: admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`), data, action: 'set' });
    this.linkedTransactions.push(data.uid);
    return data;
  }

  public createBillPayment(order: Transaction, payment: Transaction): Transaction[] {
    if (order.type !== TransactionType.ORDER) {
      throw new Error('Order was not provided as transaction.');
    }
    const transOut: Transaction[] = [];
    let royaltyAmt = order.payload.royaltiesSpaceAddress ? Math.ceil(order.payload.amount * (order.payload.royaltiesFee || 0)) : 0;
    let finalAmt = payment.payload.amount - royaltyAmt;

    if (royaltyAmt < MIN_AMOUNT_TO_TRANSFER) {
      finalAmt = finalAmt + royaltyAmt;
      royaltyAmt = 0;
    }

    if (finalAmt > 0) {
      const data = <Transaction>{
        type: TransactionType.BILL_PAYMENT,
        uid: getRandomEthAddress(),
        space: order.payload.beneficiary !== 'member' ? order.space : null,
        member: order.member,
        createdOn: serverTime(),
        payload: {
          amount: finalAmt,
          sourceAddress: order.payload.targetAddress,
          previousOwnerEntity: order.payload.beneficiary,
          previousOwner: order.payload.beneficiaryUid,
          targetAddress: order.payload.beneficiaryAddress,
          sourceTransaction: [order.uid],
          nft: order.payload.nft || null,
          reconciled: true,
          royalty: false,
          void: false,
          collection: order.payload.collection || null,
          token: order.payload.token || null,
          quantity: order.payload.quantity || null
        }
      };
      this.updates.push({ ref: admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`), data, action: 'set' });
      transOut.push(data);
      this.linkedTransactions.push(data.uid);
    }

    if (royaltyAmt > 0) {
      const data = <Transaction>{
        type: TransactionType.BILL_PAYMENT,
        uid: getRandomEthAddress(),
        member: order.member,
        space: order.payload.royaltiesSpace,
        createdOn: serverTime(),
        payload: {
          amount: royaltyAmt,
          sourceAddress: order.payload.targetAddress,
          targetAddress: order.payload.royaltiesSpaceAddress,
          sourceTransaction: [order.uid],
          previousOwnerEntity: order.payload.beneficiary,
          previousOwner: order.payload.beneficiaryUid,
          reconciled: true,
          royalty: true,
          void: false,
          delay: SECONDARY_TRANSACTION_DELAY,
          nft: order.payload.nft || null,
          collection: order.payload.collection || null,
          token: order.payload.token || null,
          quantity: order.payload.quantity || null
        }
      };
      this.updates.push({ ref: admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`), data, action: 'set' });
      transOut.push(data);
      this.linkedTransactions.push(data.uid);
    }

    return transOut;
  }

  public createCredit(payment: Transaction, tran: TransactionMatch, createdOn = serverTime(), setLink = true): Transaction | undefined {
    if (payment.type !== TransactionType.PAYMENT) {
      throw new Error('Payment was not provided as transaction.');
    }
    if (payment.payload.amount > 0) {
      const data = <Transaction>{
        type: TransactionType.CREDIT,
        uid: getRandomEthAddress(),
        space: payment.space,
        member: payment.member,
        createdOn,
        payload: {
          amount: payment.payload.amount,
          sourceAddress: tran.to.address,
          targetAddress: tran.from.address,
          sourceTransaction: [payment.uid],
          nft: payment.payload.nft || null,
          token: payment.payload.token || null,
          reconciled: true,
          void: false,
          collection: payment.payload.collection || null,
          invalidPayment: payment.payload.invalidPayment
        }
      };
      this.updates.push({ ref: admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`), data: data, action: 'set' });
      setLink && this.linkedTransactions.push(data.uid)
      return data;
    }
    return undefined
  }

  public async markAsReconciled(transaction: Transaction, chainRef: string) {
    const refSource = admin.firestore().collection(COL.TRANSACTION).doc(transaction.uid);
    const sfDoc = await this.transaction.get(refSource);
    if (sfDoc.data()) {
      const data = <Transaction>sfDoc.data();
      data.payload.reconciled = true;
      data.payload.chainReference = chainRef;
      this.updates.push({ ref: refSource, data: data, action: 'update' });
    }
  }

  public isMatch(tran: MilestoneTransaction, toAddress: string, amount: number, validationType: TransactionValidationType): TransactionMatch | undefined {
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

  public processAsInvalid(tran: MilestoneTransaction, order: TransactionOrder, tranOutput: MilestoneTransactionEntry): void {
    const fromAddress: MilestoneTransactionEntry = tran.inputs?.[0];
    // if invalid proceed with credit.
    if (fromAddress) {
      const wrongTransaction: TransactionMatch = {
        msgId: tran.messageId,
        from: fromAddress,
        to: tranOutput
      };
      const payment = this.createPayment(order, wrongTransaction, true);
      this.createCredit(payment, wrongTransaction);
    }
  }
}
