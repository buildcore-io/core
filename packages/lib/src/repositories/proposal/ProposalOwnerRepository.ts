import { ProposalMember, PublicCollections, PublicSubCollections } from '@build-5/interfaces';
import { Build5Env } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class ProposalOwnerRepository extends SubCrudRepository<ProposalMember> {
  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.PROPOSAL, PublicSubCollections.OWNERS);
  }
}
