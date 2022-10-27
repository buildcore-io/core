import { ProposalMember, PublicCollections, PublicSubCollections } from '@soon/interfaces';
import { SoonEnv } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class ProposalOwnerRepository extends SubCrudRepository<ProposalMember> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.PROPOSAL, PublicSubCollections.OWNERS);
  }
}
