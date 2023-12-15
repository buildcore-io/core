import { GetManyAdvancedRequest, Opr, ProposalMember } from '@build-5/interfaces';
import { SubsetClass } from '../Subset';

export class ProposalMemberSubset extends SubsetClass<ProposalMember> {
  getVotingMembersLive = (voted: boolean, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      setId: this.setId,
      subset: this.subset,
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
