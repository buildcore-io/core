import { PublicCollections, Ticker } from '@build-5/interfaces';
import { Build5Env } from '../Config';
import { CrudRepository } from './CrudRepository';

export class TickerRepository extends CrudRepository<Ticker> {
  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.TICKER);
  }
}
