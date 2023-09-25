import { ITransaction } from '@build-5/database';
import { MilestoneTransaction, MilestoneTransactionEntry, Transaction } from '@build-5/interfaces';
import { TransactionMatch, TransactionService } from './transaction-service';

export interface HandlerParams {
  owner: string;

  tran: MilestoneTransaction;
  tranEntry: MilestoneTransactionEntry;
  match: TransactionMatch;

  payment: Transaction | undefined;

  order: Transaction;
  build5Tran: Transaction | undefined;

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
