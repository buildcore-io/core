import { GetManyAdvancedRequest, Opr, ProposalMember } from '@buildcore/interfaces';
import { SubsetClass } from '../Subset';

/**
 * Proposal Member subset
 */
export class ProposalMemberSubset extends SubsetClass<ProposalMember> {
  /**
   * TODO
   *
   * @param voted
   * @param startAfter
   * @returns
   */
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
