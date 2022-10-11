import {
  ADDRESS_UNLOCK_CONDITION_TYPE,
  EXPIRATION_UNLOCK_CONDITION_TYPE,
  IExpirationUnlockCondition,
  UnlockConditionTypes,
} from '@iota/iota.js-next';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { DEFAULT_NETWORK, MIN_AMOUNT_TO_TRANSFER } from '../../../interfaces/config';
import { Transaction } from '../../../interfaces/models';
import { COL } from '../../../interfaces/models/base';
import {
  MilestoneTransaction,
  MilestoneTransactionEntry,
} from '../../../interfaces/models/milestone';
import {
  TransactionIgnoreWalletReason,
  TransactionOrder,
  TransactionOrderType,
  TransactionType,
  TransactionUnlockType,
  TransactionValidationType,
} from '../../../interfaces/models/transaction';
import admin from '../../admin.config';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

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

  constructor(public readonly transaction: FirebaseFirestore.Transaction) {}

  public submit(): void {
    this.updates.forEach((params) => {
      if (params.action === 'set') {
        this.transaction.set(params.ref, params.data, { merge: params.merge || false });
      } else {
        this.transaction.update(params.ref, params.data);
      }
    });
  }

  public createPayment(
    order: Transaction,
    tran: TransactionMatch,
    invalidPayment = false,
  ): Transaction {
    if (order.type !== TransactionType.ORDER) {
      throw new Error('Order was not provided as transaction.');
    }
    const data: Transaction = <Transaction>{
      type: TransactionType.PAYMENT,
      uid: getRandomEthAddress(),
      member: order.member || '',
      space: order.space || '',
      createdOn: serverTime(),
      network: order.network || DEFAULT_NETWORK,
      payload: {
        // This must be the amount they send. As we're handing both correct amount from order or invalid one.
        amount: tran.to.amount,
        nativeTokens: tran.to.nativeTokens || [],
        sourceAddress: tran.from.address,
        targetAddress: order.payload.targetAddress,
        reconciled: true,
        void: false,
        sourceTransaction: [order.uid],
        chainReference: tran.msgId,
        nft: order.payload.nft || null,
        collection: order.payload.collection || null,
        token: order.payload.token || null,
        invalidPayment: invalidPayment,
      },
    };
    this.updates.push({
      ref: admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`),
      data,
      action: 'set',
    });
    this.linkedTransactions.push(data.uid);
    return data;
  }

  public createBillPayment(order: Transaction, payment: Transaction): Transaction[] {
    if (order.type !== TransactionType.ORDER) {
      throw new Error('Order was not provided as transaction.');
    }
    const transOut: Transaction[] = [];
    let royaltyAmt = order.payload.royaltiesSpaceAddress
      ? Math.ceil(order.payload.amount * (order.payload.royaltiesFee || 0))
      : 0;
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
        network: order.network || DEFAULT_NETWORK,
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
          quantity: order.payload.quantity || null,
        },
      };
      this.updates.push({
        ref: admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`),
        data,
        action: 'set',
      });
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
        network: order.network || DEFAULT_NETWORK,
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
          nft: order.payload.nft || null,
          collection: order.payload.collection || null,
          token: order.payload.token || null,
          quantity: order.payload.quantity || null,
        },
      };
      this.updates.push({
        ref: admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`),
        data,
        action: 'set',
      });
      transOut.push(data);
      this.linkedTransactions.push(data.uid);
    }

    return transOut;
  }

  public createCredit(
    payment: Transaction,
    tran: TransactionMatch,
    createdOn = serverTime(),
    setLink = true,
    ignoreWalletReason = TransactionIgnoreWalletReason.NONE,
  ): Transaction | undefined {
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
        network: payment.network || DEFAULT_NETWORK,
        payload: {
          amount: payment.payload.amount,
          nativeTokens: (tran.to.nativeTokens || []).map((nt) => ({
            ...nt,
            amount: Number(nt.amount),
          })),
          sourceAddress: tran.to.address,
          targetAddress: tran.from.address,
          sourceTransaction: [payment.uid],
          nft: payment.payload.nft || null,
          token: payment.payload.token || null,
          reconciled: true,
          void: false,
          collection: payment.payload.collection || null,
          invalidPayment: payment.payload.invalidPayment,
        },
        ignoreWallet: !isEmpty(ignoreWalletReason),
        ignoreWalletReason,
      };
      this.updates.push({
        ref: admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`),
        data: data,
        action: 'set',
      });
      setLink && this.linkedTransactions.push(data.uid);
      return data;
    }
    return undefined;
  }

  public createNftCredit(
    payment: Transaction,
    tran: TransactionMatch,
    setLink = true,
  ): Transaction | undefined {
    if (payment.type !== TransactionType.PAYMENT) {
      throw new Error('Payment was not provided as transaction.');
    }
    if (payment.payload.amount > 0) {
      const data = <Transaction>{
        type: TransactionType.CREDIT_NFT,
        uid: getRandomEthAddress(),
        space: payment.space || '',
        member: payment.member || '',
        createdOn: serverTime(),
        network: payment.network || DEFAULT_NETWORK,
        payload: {
          amount: payment.payload.amount,
          sourceAddress: tran.to.address,
          targetAddress: tran.from.address,
          sourceTransaction: [payment.uid],
          reconciled: true,
          void: false,
          nftId: tran.to.nftOutput?.nftId,
          invalidPayment: payment.payload.invalidPayment,
        },
      };
      this.updates.push({
        ref: admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`),
        data: data,
        action: 'set',
      });
      setLink && this.linkedTransactions.push(data.uid);
      return data;
    }
    return undefined;
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

  public isMatch(
    tran: MilestoneTransaction,
    tranOutput: MilestoneTransactionEntry,
    order: TransactionOrder,
    soonTransaction?: Transaction,
  ): TransactionMatch | undefined {
    const unsupportedUnlockCondition = this.getUnsupportedUnlockCondition(
      tranOutput.unlockConditions,
    );
    if (unsupportedUnlockCondition !== undefined) {
      return;
    }
    let found: TransactionMatch | undefined;
    const fromAddress: MilestoneTransactionEntry = tran.inputs?.[0];
    if (fromAddress && tran.outputs) {
      for (const o of tran.outputs) {
        // Ignore output that contains input address. Remaining balance.
        if (
          soonTransaction?.type !== TransactionType.UNLOCK &&
          tran.inputs.find((i) => {
            return o.address === i.address;
          })
        ) {
          continue;
        }

        const isValid =
          o.amount === order.payload.amount ||
          order.payload.validationType === TransactionValidationType.ADDRESS;
        if (o.address === order.payload.targetAddress && isValid) {
          found = {
            msgId: tran.messageId,
            from: fromAddress,
            to: o,
          };
        }
      }
    }

    return found;
  }

  public processAsInvalid(
    tran: MilestoneTransaction,
    order: TransactionOrder,
    tranOutput: MilestoneTransactionEntry,
  ): void {
    const fromAddress: MilestoneTransactionEntry = tran.inputs?.[0];
    // if invalid proceed with credit.
    if (fromAddress) {
      const wrongTransaction: TransactionMatch = {
        msgId: tran.messageId,
        from: fromAddress,
        to: tranOutput,
      };
      const payment = this.createPayment(order, wrongTransaction, true);
      const unsupportedUnlockCondition = this.getUnsupportedUnlockCondition(
        tranOutput.unlockConditions,
      );
      const ignoreWalletReason =
        unsupportedUnlockCondition !== undefined
          ? TransactionIgnoreWalletReason.UNREFUNDABLE_DUE_UNLOCK_CONDITIONS
          : TransactionIgnoreWalletReason.NONE;
      if (order.payload.type === TransactionOrderType.DEPOSIT_NFT) {
        this.createNftCredit(payment, wrongTransaction);
        return;
      }
      this.createCredit(payment, wrongTransaction, serverTime(), true, ignoreWalletReason);
    }
  }

  public createUnlockTransaction = async (
    expirationUnlock: IExpirationUnlockCondition,
    order: TransactionOrder,
    tranOutput: MilestoneTransactionEntry,
  ) => {
    const data = <Transaction>{
      type: TransactionType.UNLOCK,
      uid: getRandomEthAddress(),
      space: order.payload.beneficiary !== 'member' ? order.space : null,
      member: order.member,
      createdOn: serverTime(),
      network: order.network || DEFAULT_NETWORK,
      payload: {
        type: tranOutput.nftOutput
          ? TransactionUnlockType.UNLOCK_NFT
          : TransactionUnlockType.UNLOCK_FUNDS,
        amount: tranOutput.amount,
        nativeTokens: tranOutput.nativeTokens || [],
        sourceAddress: tranOutput.address,
        targetAddress: tranOutput.address,
        sourceTransaction: [order.uid],
        expiresOn: dateToTimestamp(dayjs.unix(expirationUnlock.unixTime).toDate()),
      },
    };
    this.updates.push({
      ref: admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`),
      data,
      action: 'set',
    });
  };

  public getExpirationUnlock = (unlockCondiiton: UnlockConditionTypes[] = []) =>
    unlockCondiiton.find((u) => u.type === EXPIRATION_UNLOCK_CONDITION_TYPE) as
      | IExpirationUnlockCondition
      | undefined;

  private getUnsupportedUnlockCondition = (unlockCondiiton: UnlockConditionTypes[] = []) =>
    unlockCondiiton.find(
      (u) =>
        u.type !== ADDRESS_UNLOCK_CONDITION_TYPE && u.type !== EXPIRATION_UNLOCK_CONDITION_TYPE,
    );
}
