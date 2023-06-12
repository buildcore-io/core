import { PublicCollections, Ticker } from '@build5/interfaces';
import { SoonEnv } from '../Config';
import { CrudRepository } from './CrudRepository';

export class TickerRepository extends CrudRepository<Ticker> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.TICKER);
  }
}
