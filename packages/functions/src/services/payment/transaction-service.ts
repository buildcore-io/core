import {
  ADDRESS_UNLOCK_CONDITION_TYPE,
  EXPIRATION_UNLOCK_CONDITION_TYPE,
  IExpirationUnlockCondition,
  STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE,
  TIMELOCK_UNLOCK_CONDITION_TYPE,
  UnlockConditionTypes,
} from '@iota/iota.js-next';
import {
  COL,
  DEFAULT_NETWORK,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  MIN_AMOUNT_TO_TRANSFER,
  StorageReturn,
  SUB_COL,
  Timestamp,
  Token,
  Transaction,
  TransactionCreditType,
  TransactionIgnoreWalletReason,
  TransactionOrder,
  TransactionOrderType,
  TransactionType,
  TransactionUnlockType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty, set } from 'lodash';
import admin from '../../admin.config';
import { SmrMilestoneTransactionAdapter } from '../../triggers/milestone-transactions-triggers/SmrMilestoneTransactionAdapter';
import { getOutputMetadata } from '../../utils/basic-output.utils';
import { cOn, dateToTimestamp, serverTime, uOn } from '../../utils/dateTime.utils';
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
      const dateFunc = params.merge || params.action === 'update' ? uOn : cOn;
      const data = dateFunc(params.data);
      if (params.action === 'set') {
        this.transaction.set(params.ref, data, { merge: params.merge || false });
      } else {
        this.transaction.update(params.ref, data);
      }
    });
  }

  public async createPayment(
    order: Transaction,
    tran: TransactionMatch,
    invalidPayment = false,
  ): Promise<Transaction> {
    if (order.type !== TransactionType.ORDER) {
      throw new Error('Order was not provided as transaction.');
    }
    const data: Transaction = <Transaction>{
      type: TransactionType.PAYMENT,
      uid: getRandomEthAddress(),
      member: order.member || '',
      space: order.space || '',
      network: order.network || DEFAULT_NETWORK,
      payload: {
        // This must be the amount they send. As we're handing both correct amount from order or invalid one.
        amount: tran.to.amount,
        nativeTokens: (tran.to.nativeTokens || []).map((nt) => ({
          ...nt,
          amount: Number(nt.amount),
        })),
        sourceAddress: tran.from.address,
        targetAddress: order.payload.targetAddress,
        reconciled: true,
        void: false,
        sourceTransaction: [order.uid],
        chainReference: tran.msgId,
        nft: order.payload.nft || null,
        collection: order.payload.collection || null,
        invalidPayment,
      },
    };

    if (order.payload.token) {
      const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${order.payload.token}`);
      const token = <Token | undefined>(await tokenDocRef.get()).data();
      if (token) {
        set(data, 'payload.token', token.uid);
        set(data, 'payload.tokenSymbol', token.symbol);
      }
    }
    this.updates.push({
      ref: admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`),
      data,
      action: 'set',
    });
    if (order.payload.type !== TransactionOrderType.TANGLE_REQUEST) {
      this.linkedTransactions.push(data.uid);
    }
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
        network: order.network || DEFAULT_NETWORK,
        payload: {
          amount: finalAmt,
          sourceAddress: order.payload.targetAddress,
          previousOwnerEntity: order.payload.beneficiary,
          previousOwner: order.payload.beneficiaryUid,
          ownerEntity: order.payload.beneficiary,
          owner: order.payload.beneficiary === 'member' ? order.member : order.space,
          targetAddress: order.payload.beneficiaryAddress,
          sourceTransaction: [order.uid],
          nft: order.payload.nft || null,
          reconciled: true,
          royalty: false,
          void: false,
          collection: order.payload.collection || null,
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

  public async createCredit(
    type: TransactionCreditType,
    payment: Transaction,
    tran: TransactionMatch,
    createdOn = serverTime(),
    setLink = true,
    ignoreWalletReason = TransactionIgnoreWalletReason.NONE,
    storageReturn?: StorageReturn,
    customPayload?: { [key: string]: unknown },
  ): Promise<Transaction | undefined> {
    if (payment.payload.amount > 0) {
      const data = <Transaction>{
        type: TransactionType.CREDIT,
        uid: getRandomEthAddress(),
        space: payment.space,
        member: payment.member,
        createdOn,
        network: payment.network || DEFAULT_NETWORK,
        payload: {
          type,
          amount: payment.payload.amount,
          nativeTokens: (tran.to.nativeTokens || []).map((nt) => ({
            ...nt,
            amount: Number(nt.amount),
          })),
          sourceAddress: tran.to.address,
          targetAddress: tran.from.address,
          sourceTransaction: [payment.uid],
          nft: payment.payload.nft || null,
          reconciled: true,
          void: false,
          collection: payment.payload.collection || null,
          invalidPayment: payment.payload.invalidPayment,
          ...customPayload,
        },
        ignoreWallet: !isEmpty(ignoreWalletReason),
        ignoreWalletReason,
      };
      if (storageReturn) {
        set(data, 'payload.storageReturn', storageReturn);
      }

      if (payment.payload.token) {
        const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${payment.payload.token}`);
        const token = <Token | undefined>(await tokenDocRef.get()).data();
        if (token) {
          set(data, 'payload.token', token.uid);
          set(data, 'payload.tokenSymbol', token.symbol);
        }
      }
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

  public createTangleCredit(
    payment: Transaction,
    tran: TransactionMatch,
    response: Record<string, unknown>,
    outputToConsume: string,
  ) {
    if (payment.payload.amount > 0) {
      const data: Transaction = {
        type: TransactionType.CREDIT_TANGLE_REQUEST,
        uid: getRandomEthAddress(),
        space: payment.space,
        member: payment.member,
        network: payment.network,
        payload: {
          amount: payment.payload.amount,
          nativeTokens: (tran.to.nativeTokens || []).map((nt) => ({
            ...nt,
            amount: Number(nt.amount),
          })),
          sourceAddress: tran.to.address,
          targetAddress: tran.from.address,
          sourceTransaction: [payment.uid],
          reconciled: true,
          void: false,
          outputToConsume,
          response,
        },
        linkedTransactions: [],
      };
      this.updates.push({
        ref: admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`),
        data: data,
        action: 'set',
      });
      return data;
    }
    return undefined;
  }

  public createNftCredit(
    payment: Transaction,
    tran: TransactionMatch,
    error?: Record<string, unknown>,
    customErrorParams: Record<string, unknown> = {},
  ) {
    const response = error
      ? { status: 'error', code: error.code || '', message: error.key || '', ...customErrorParams }
      : {};
    const transaction = <Transaction>{
      type: TransactionType.CREDIT_NFT,
      uid: getRandomEthAddress(),
      space: payment.space || '',
      member: payment.member || '',
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
        response,
      },
    };
    this.updates.push({
      ref: admin.firestore().doc(`${COL.TRANSACTION}/${transaction.uid}`),
      data: transaction,
      action: 'set',
    });
    this.linkedTransactions.push(transaction.uid);
    return transaction;
  }

  public markAsReconciled = (transaction: Transaction, chainRef: string) =>
    this.updates.push({
      ref: admin.firestore().doc(`${COL.TRANSACTION}/${transaction.uid}`),
      data: {
        'payload.reconciled': true,
        'payload.chainReference': chainRef,
      },
      action: 'update',
    });

  private getFromAddress = async (
    tran: MilestoneTransaction,
    order: TransactionOrder,
    soonTransaction?: Transaction,
  ) => {
    if (soonTransaction?.type === TransactionType.UNLOCK) {
      const doc = await admin
        .firestore()
        .doc(soonTransaction.payload.milestoneTransactionPath)
        .get();
      const adapter = new SmrMilestoneTransactionAdapter(order.network!);
      const milestoneTransaction = await adapter.toMilestoneTransaction(doc);
      return milestoneTransaction.inputs?.[0];
    }
    return tran.inputs?.[0];
  };

  public async isMatch(
    tran: MilestoneTransaction,
    tranOutput: MilestoneTransactionEntry,
    order: TransactionOrder,
    soonTransaction?: Transaction,
  ): Promise<TransactionMatch | undefined> {
    const unsupportedUnlockCondition = this.getUnsupportedUnlockCondition(
      tranOutput.unlockConditions,
    );
    if (unsupportedUnlockCondition !== undefined) {
      return;
    }
    let found: TransactionMatch | undefined;
    const fromAddress: MilestoneTransactionEntry = await this.getFromAddress(
      tran,
      order,
      soonTransaction,
    );
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

  public async processAsInvalid(
    tran: MilestoneTransaction,
    order: TransactionOrder,
    tranOutput: MilestoneTransactionEntry,
    soonTransaction?: Transaction,
  ): Promise<void> {
    const fromAddress: MilestoneTransactionEntry = await this.getFromAddress(
      tran,
      order,
      soonTransaction,
    );
    if (fromAddress) {
      const match: TransactionMatch = {
        msgId: tran.messageId,
        from: fromAddress,
        to: tranOutput,
      };
      const payment = await this.createPayment(order, match, true);
      const ignoreWalletReason = this.getIngnoreWalletReason(tranOutput.unlockConditions || []);
      if (order.payload.type === TransactionOrderType.DEPOSIT_NFT) {
        this.createNftCredit(payment, match);
        return;
      }
      await this.createCredit(
        TransactionCreditType.INVALID_PAYMENT,
        payment,
        match,
        serverTime(),
        true,
        ignoreWalletReason,
      );
    }
  }

  private getIngnoreWalletReason = (unlockConditions: UnlockConditionTypes[]) => {
    const hasTimelock =
      unlockConditions.find((u) => u.type === TIMELOCK_UNLOCK_CONDITION_TYPE) !== undefined;
    if (hasTimelock) {
      return TransactionIgnoreWalletReason.UNREFUNDABLE_DUE_TIMELOCK_CONDITION;
    }
    const hasStorageDepositLock =
      unlockConditions.find((u) => u.type === STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE) !==
      undefined;
    if (hasStorageDepositLock) {
      return TransactionIgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION;
    }
    return TransactionIgnoreWalletReason.NONE;
  };

  public createUnlockTransaction = async (
    order: TransactionOrder,
    tran: MilestoneTransaction,
    tranOutput: MilestoneTransactionEntry,
    type: TransactionUnlockType,
    outputToConsume = '',
    expiresOn?: Timestamp,
  ) => {
    const network = order.network || DEFAULT_NETWORK;
    const data = <Transaction>{
      type: TransactionType.UNLOCK,
      uid: getRandomEthAddress(),
      space: order.space || '',
      member: order.member || tranOutput.address,
      network,
      payload: {
        type,
        amount: tranOutput.amount,
        nativeTokens: (tranOutput.nativeTokens || []).map((nt) => ({
          ...nt,
          amount: Number(nt.amount),
        })),
        sourceAddress: tranOutput.address,
        targetAddress:
          type === TransactionUnlockType.TANGLE_TRANSFER
            ? order.payload.targetAddress
            : tranOutput.address,
        sourceTransaction: [order.uid],
        expiresOn: expiresOn || dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
        milestoneTransactionPath: `${COL.MILESTONE}_${network}/${tran.milestone}/${SUB_COL.TRANSACTIONS}/${tran.uid}`,
        outputToConsume,
        customMetadata: getOutputMetadata(tranOutput.output),
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

  private getUnsupportedUnlockCondition = (
    unlockCondiiton: UnlockConditionTypes[] = [],
    supportedUnlockConditions = SUPPORTED_UNLOCK_CONDITION,
  ) => unlockCondiiton.find((u) => !supportedUnlockConditions.includes(u.type));
}

const SUPPORTED_UNLOCK_CONDITION = [
  ADDRESS_UNLOCK_CONDITION_TYPE,
  EXPIRATION_UNLOCK_CONDITION_TYPE,
];
