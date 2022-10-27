import { Proposal, PublicCollections } from '@soon/interfaces';
import { SoonEnv } from '../../Config';
import { CrudRepository } from '../CrudRepository';

export class ProposalRepository extends CrudRepository<Proposal> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.PROPOSAL);
  }
}
