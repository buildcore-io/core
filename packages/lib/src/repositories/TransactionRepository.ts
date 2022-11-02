import { PublicCollections, Transaction } from '@soonaverse/interfaces';
import { SoonEnv } from '../Config';
import { CrudRepository } from './CrudRepository';

export class TransactionRepository extends CrudRepository<Transaction> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.TRANSACTION);
  }
}
