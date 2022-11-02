import { ProposalMember, PublicCollections, PublicSubCollections } from '@soonaverse/interfaces';
import { SoonEnv } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class ProposalOwnerRepository extends SubCrudRepository<ProposalMember> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.PROPOSAL, PublicSubCollections.OWNERS);
  }
}
