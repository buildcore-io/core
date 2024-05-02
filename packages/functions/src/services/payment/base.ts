import { ITransaction } from '@buildcore/database';
import {
  MilestoneTransaction,
  MilestoneTransactionEntry,
  Transaction,
} from '@buildcore/interfaces';
import { TransactionMatch, TransactionService } from './transaction-service';

export interface HandlerParams {
  owner: string;

  tran: MilestoneTransaction;
  tranEntry: MilestoneTransactionEntry;
  match: TransactionMatch;

  payment: Transaction | undefined;

  order: Transaction;
  buildcoreTran: Transaction | undefined;

  project: string;

  request: Record<string, unknown>;
}

export abstract class BaseService {
  protected transaction: ITransaction;

  constructor(readonly transactionService: TransactionService) {
    this.transaction = transactionService.transaction;
  }

  abstract handleRequest(params: HandlerParams): Promise<unknown>;
}

export abstract class BaseTangleService<T> extends BaseService {
  abstract handleRequest(params: HandlerParams): Promise<T>;
}
