import { BaseRecord, IDocument, ITransaction, Update, database } from '@buildcore/database';
import {
  COL,
  DEFAULT_NETWORK,
  IgnoreWalletReason,
  MIN_AMOUNT_TO_TRANSFER,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  SUB_COL,
  StorageReturn,
  TRANSACTION_AUTO_EXPIRY_MS,
  Timestamp,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  getMilestoneCol,
} from '@buildcore/interfaces';
import { ExpirationUnlockCondition, UnlockCondition, UnlockConditionType } from '@iota/sdk';
import dayjs from 'dayjs';
import { get, isEmpty, set } from 'lodash';
import { MilestoneTransactionAdapter } from '../../triggers/milestone-transactions-triggers/MilestoneTransactionAdapter';
import { getOutputMetadata } from '../../utils/basic-output.utils';
import { getProject } from '../../utils/common.utils';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { logger } from '../../utils/logger';
import { getPathParts } from '../../utils/milestone';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export interface TransactionMatch {
  msgId: string;
  from: string;
  to: MilestoneTransactionEntry;
}

export enum Action {
  C = 'create',
  U = 'update',
  UPS = 'upsert',
  D = 'delete',
}

// prettier-ignore
type DataType<C, U extends Update, A extends Action> =
    A extends Action.C ? C :
    A extends Action.U ? U :
    A extends Action.UPS ? U :
    A extends Action.D ? undefined :
    never;

interface TransactionUpdates<C, B extends BaseRecord, U extends Update, A extends Action> {
  ref: IDocument<C, B, U>;
  data: DataType<C, U, A>;
  action: A;
}

export class TransactionService {
  public readonly linkedTransactions: string[] = [];
  private readonly updates: TransactionUpdates<unknown, BaseRecord, Update, Action>[] = [];

  constructor(public readonly transaction: ITransaction) {}

  public submit = async () => {
    const promises = this.updates.map((params) => {
      switch (params.action) {
        case Action.C:
          return this.transaction.create(params.ref, params.data);
        case Action.U:
          return this.transaction.update(params.ref, params.data as Update);
        case Action.UPS:
          return this.transaction.upsert(params.ref, params.data as Update);
        case Action.D:
          return this.transaction.delete(params.ref);
        default:
          throw Error('Invalid action ' + params.action);
      }
    });
    await Promise.all(promises);
  };

  public push = <C, B extends BaseRecord, U extends Update, A extends Action>(
    update: TransactionUpdates<C, B, U, A>,
  ) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.updates.push(update as any);

  public async createPayment(
    order: Transaction,
    tran: TransactionMatch,
    invalidPayment = false,
  ): Promise<Transaction> {
    if (order.type !== TransactionType.ORDER) {
      throw new Error('Order was not provided as transaction.');
    }
    const data: Transaction = {
      project: getProject(order),
      type: TransactionType.PAYMENT,
      uid: getRandomEthAddress(),
      member: order.member || tran.from,
      space: order.space || '',
      network: order.network || DEFAULT_NETWORK,
      payload: {
        amount: tran.to.amount,
        nativeTokens: (tran.to.nativeTokens || []).map((nt) => ({
          ...nt,
          amount: BigInt(nt.amount),
        })),
        sourceAddress: tran.from,
        targetAddress: order.payload.targetAddress,
        reconciled: true,
        void: false,
        sourceTransaction: [order.uid],
        chainReference: tran.msgId || null,
        nft: order.payload.nft || tran.to.nftOutput?.nftId || null,
        collection: order.payload.collection || null,
        invalidPayment,
      },
    };
    if (tran.to.tag) {
      data.payload.tag = tran.to.tag;
    }
    if (order.payload.stamp) {
      data.payload.stamp = order.payload.stamp;
    }
    if (order.payload.auction) {
      data.payload.auction = order.payload.auction;
    }

    if (order.payload.token) {
      const tokenDocRef = database().doc(COL.TOKEN, order.payload.token);
      const token = await tokenDocRef.get();
      if (token) {
        set(data, 'payload.token', token.uid);
        set(data, 'payload.tokenSymbol', token.symbol);
      }
    }
    this.push({ ref: database().doc(COL.TRANSACTION, data.uid), data, action: Action.C });
    if (order.payload.type !== TransactionPayloadType.TANGLE_REQUEST) {
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
      ? Math.ceil(order.payload.amount! * (order.payload.royaltiesFee || 0))
      : 0;
    let finalAmt = payment.payload.amount! - royaltyAmt;

    if (royaltyAmt < MIN_AMOUNT_TO_TRANSFER) {
      finalAmt = finalAmt + royaltyAmt;
      royaltyAmt = 0;
    }

    if (finalAmt > 0) {
      const data: Transaction = {
        project: getProject(payment),
        type: TransactionType.BILL_PAYMENT,
        uid: getRandomEthAddress(),
        space: (order.payload.beneficiary !== 'member' ? order.space : null) as string,
        member: order.member || payment.member || '',
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
          quantity: (order.payload.quantity || null) as number,
          restrictions: order.payload.restrictions || {},
        },
      };
      this.push({ ref: database().doc(COL.TRANSACTION, data.uid), data, action: Action.C });
      transOut.push(data);
      this.linkedTransactions.push(data.uid);
    }

    if (royaltyAmt > 0) {
      const data: Transaction = {
        project: getProject(payment),
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
          quantity: (order.payload.quantity || null) as number,
          restrictions: order.payload.restrictions || {},
        },
      };
      this.push({
        ref: database().doc(COL.TRANSACTION, data.uid),
        data,
        action: Action.C,
      });
      transOut.push(data);
      this.linkedTransactions.push(data.uid);
    }

    return transOut;
  }

  public async createCredit(
    type: TransactionPayloadType,
    payment: Transaction,
    tran: TransactionMatch,
    createdOn = serverTime(),
    setLink = true,
    ignoreWalletReason = IgnoreWalletReason.NONE,
    storageReturn?: StorageReturn,
    customPayload?: { [key: string]: unknown },
    response: { [key: string]: unknown } = {},
    expiresOn?: Timestamp,
  ): Promise<Transaction | undefined> {
    if (payment.payload.amount! > 0) {
      const data: Transaction = {
        project: getProject(payment),
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
            amount: BigInt(nt.amount),
          })),
          sourceAddress: tran.to.address,
          targetAddress: tran.from,
          sourceTransaction: [payment.uid],
          nft: payment.payload.nft || null,
          reconciled: true,
          void: false,
          collection: payment.payload.collection || null,
          invalidPayment: payment.payload.invalidPayment,
          ...customPayload,
          response,
        },
        ignoreWallet: !isEmpty(ignoreWalletReason),
        ignoreWalletReason,
      };
      if (storageReturn) {
        set(data, 'payload.storageReturn', storageReturn);
      }
      if (expiresOn) {
        set(data, 'payload.expiresOn', expiresOn);
      }

      if (payment.payload.token) {
        const tokenDocRef = database().doc(COL.TOKEN, payment.payload.token);
        const token = await tokenDocRef.get();
        if (token) {
          set(data, 'payload.token', token.uid);
          set(data, 'payload.tokenSymbol', token.symbol);
        }
      }
      this.push({ ref: database().doc(COL.TRANSACTION, data.uid), data, action: Action.C });
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
    if (payment.payload.amount! > 0) {
      const data: Transaction = {
        project: getProject(payment),
        type: TransactionType.CREDIT_TANGLE_REQUEST,
        uid: getRandomEthAddress(),
        space: payment.space,
        member: payment.member,
        network: payment.network,
        payload: {
          amount: payment.payload.amount,
          nativeTokens: (tran.to.nativeTokens || []).map((nt) => ({
            ...nt,
            amount: BigInt(nt.amount),
          })),
          sourceAddress: tran.to.address,
          targetAddress: tran.from,
          sourceTransaction: [payment.uid],
          reconciled: true,
          void: false,
          outputToConsume,
          response,
        },
        linkedTransactions: [],
      };
      this.push({
        ref: database().doc(COL.TRANSACTION, data.uid),
        data: data,
        action: Action.C,
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
    ignoreWalletReason = IgnoreWalletReason.NONE,
    expiresOn?: Timestamp,
  ) {
    const response = error
      ? { status: 'error', code: error.code || '', message: error.key || '', ...customErrorParams }
      : {};
    if (!isEmpty(error) && !get(error, 'code')) {
      logger.error('createNftCredit-error', payment.uid, tran.to.nftOutput?.nftId, error);
    }
    const transaction: Transaction = {
      project: getProject(payment),
      type: TransactionType.CREDIT_NFT,
      uid: getRandomEthAddress(),
      space: payment.space || '',
      member: payment.member || '',
      network: payment.network || DEFAULT_NETWORK,
      payload: {
        amount: payment.payload.amount,
        sourceAddress: tran.to.address,
        targetAddress: tran.from,
        sourceTransaction: [payment.uid],
        reconciled: true,
        void: false,
        nftId: tran.to.nftOutput?.nftId || '',
        invalidPayment: payment.payload.invalidPayment,
        response,
      },
      ignoreWallet: !isEmpty(ignoreWalletReason),
      ignoreWalletReason,
    };
    if (expiresOn) {
      set(transaction, 'payload.expiresOn', expiresOn);
    }
    this.push({
      ref: database().doc(COL.TRANSACTION, transaction.uid),
      data: transaction,
      action: Action.C,
    });
    this.linkedTransactions.push(transaction.uid);
    return transaction;
  }

  public markAsReconciled = (transaction: Transaction, chainRef: string) =>
    this.push({
      ref: database().doc(COL.TRANSACTION, transaction.uid),
      data: { payload_reconciled: true, payload_chainReference: chainRef },
      action: Action.U,
    });

  private getFromAddress = async (
    tran: MilestoneTransaction,
    order: Transaction,
    buildcoreTransaction?: Transaction,
  ) => {
    if (buildcoreTransaction?.type === TransactionType.UNLOCK) {
      const { col, colId, subCol, subColId } = getPathParts(
        buildcoreTransaction.payload?.milestoneTransactionPath!,
      );
      const doc = (await database().doc(col, colId, subCol, subColId).get())!;
      const adapter = new MilestoneTransactionAdapter(order.network!);
      const milestoneTransaction = await adapter.toMilestoneTransaction(doc);
      return milestoneTransaction.fromAddresses[0];
    }
    return tran.fromAddresses[0];
  };

  public async isMatch(
    tran: MilestoneTransaction,
    tranOutput: MilestoneTransactionEntry,
    order: Transaction,
    buildcoreTransaction?: Transaction,
  ): Promise<TransactionMatch | undefined> {
    const unsupportedUnlockCondition = this.getUnsupportedUnlockCondition(
      tranOutput.unlockConditions,
    );
    if (unsupportedUnlockCondition !== undefined) {
      return;
    }
    let found: TransactionMatch | undefined;
    const fromAddress = await this.getFromAddress(tran, order, buildcoreTransaction);
    if (fromAddress && tran.outputs) {
      for (const o of tran.outputs) {
        if (
          buildcoreTransaction?.type !== TransactionType.UNLOCK &&
          tran.fromAddresses.includes(o.address)
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
    order: Transaction,
    tranOutput: MilestoneTransactionEntry,
    buildcoreTransaction: Transaction | undefined,
  ): Promise<void> {
    const fromAddress = await this.getFromAddress(tran, order, buildcoreTransaction);
    if (fromAddress) {
      const match: TransactionMatch = {
        msgId: tran.messageId,
        from: fromAddress,
        to: tranOutput,
      };
      const payment = await this.createPayment(order, match, true);
      const ignoreWalletReason = this.getIngnoreWalletReason(tranOutput.unlockConditions);
      const expiresOn = this.expiresOn(tranOutput.unlockConditions);
      if (expiresOn && dayjs(expiresOn.toDate()).isBefore(dayjs())) {
        return;
      }

      if (match.to.nftOutput?.nftId) {
        this.createNftCredit(payment, match, undefined, undefined, ignoreWalletReason, expiresOn);
        return;
      }

      await this.createCredit(
        TransactionPayloadType.INVALID_PAYMENT,
        payment,
        match,
        serverTime(),
        true,
        ignoreWalletReason,
        undefined,
        undefined,
        {},
        expiresOn,
      );
    }
  }

  private getIngnoreWalletReason = (
    unlockConditions: UnlockCondition[] = [],
  ): IgnoreWalletReason => {
    const hasTimelock =
      unlockConditions.find((u) => u.type === UnlockConditionType.Timelock) !== undefined;
    if (hasTimelock) {
      return IgnoreWalletReason.UNREFUNDABLE_DUE_TIMELOCK_CONDITION;
    }
    const hasStorageDepositLock =
      unlockConditions.find((u) => u.type === UnlockConditionType.StorageDepositReturn) !==
      undefined;
    if (hasStorageDepositLock) {
      return IgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION;
    }
    return IgnoreWalletReason.NONE;
  };

  private expiresOn = (unlockConditions: UnlockCondition[] = []) => {
    const expirationUc = unlockConditions.find((uc) => uc.type === UnlockConditionType.Expiration);
    if (!expirationUc) {
      return;
    }
    return dateToTimestamp(dayjs.unix((expirationUc as ExpirationUnlockCondition).unixTime));
  };

  public createUnlockTransaction = (
    payment: Transaction | undefined,
    order: Transaction,
    tran: MilestoneTransaction,
    tranOutput: MilestoneTransactionEntry,
    type: TransactionPayloadType,
    outputToConsume = '',
    expiresOn?: Timestamp,
  ) => {
    const network = order.network || DEFAULT_NETWORK;
    const data: Transaction = {
      project: getProject(order),
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
          amount: BigInt(nt.amount),
        })),
        sourceAddress: tranOutput.address,
        targetAddress: [
          TransactionPayloadType.TANGLE_TRANSFER,
          TransactionPayloadType.UNLOCK_NFT,
        ].includes(type)
          ? order.payload.targetAddress
          : tranOutput.address,
        sourceTransaction: [payment?.uid || order.uid],
        expiresOn: expiresOn || dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
        milestoneTransactionPath: `${getMilestoneCol(network)}/${tran.milestone}/${SUB_COL.TRANSACTIONS}/${tran.uid}`,
        outputToConsume,
        customMetadata: getOutputMetadata(tranOutput.output),
        nftId: tranOutput.nftOutput?.nftId || '',
      },
    };
    this.push({ ref: database().doc(COL.TRANSACTION, data.uid), data, action: Action.C });
  };

  public getExpirationUnlock = (unlockCondition: UnlockCondition[] = []) =>
    unlockCondition.find((u) => u.type === UnlockConditionType.Expiration) as
      | ExpirationUnlockCondition
      | undefined;

  private getUnsupportedUnlockCondition = (
    unlockConditions: UnlockCondition[] = [],
    supportedUnlockConditions = SUPPORTED_UNLOCK_CONDITION,
  ) => unlockConditions.find((u) => !supportedUnlockConditions.includes(u.type));
}

const SUPPORTED_UNLOCK_CONDITION = [UnlockConditionType.Address, UnlockConditionType.Expiration];
