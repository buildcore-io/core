import { Opr, ProposalMember, PublicCollections, PublicSubCollections } from '@build-5/interfaces';
import { SoonEnv } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class ProposalMemberRepository extends SubCrudRepository<ProposalMember> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.PROPOSAL, PublicSubCollections.MEMBERS);
  }

  public getVotingMembersLive = (proposal: string, voted: boolean, startAfter?: string) => {
    const params = {
      collection: this.col,
      uid: proposal,
      subCollection: this.subCol,
      fieldName: ['voted'],
      fieldValue: [voted],
      operator: [Opr.EQUAL],
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };
}
