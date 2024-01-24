import { AwardParticipant, GetManyAdvancedRequest, Opr } from '@build-5/interfaces';
import { SubsetClass } from '../Subset';

/**
 * Subset of Award's participatents
 */
export class AwardParticpateSubset extends SubsetClass<AwardParticipant> {
  /**
   * Get list of Award's participants. Live stream.
   *
   * @param award
   * @param completed
   * @param searchIds
   * @param startAfter
   * @returns
   */
  getParticipantsLive = (
    award: string,
    completed: boolean,
    searchIds: string[] = [],
    startAfter?: string,
  ) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      setId: award,
      subset: this.subset,
      fieldName: searchIds.map(() => 'uid').concat('completed'),
      fieldValue: (searchIds as (string | boolean)[]).concat(completed),
      operator: searchIds.map(() => Opr.IN).concat(Opr.EQUAL),
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };

  /**
   * Get Awards participants ordered by the most recent one.
   *
   * @param member
   * @param completed
   * @param startAfter
   * @returns
   */
  getTopByMemberLive = (member: string, completed = true, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      subset: this.subset,
      fieldName: ['uid', 'parentCol', 'completed'],
      fieldValue: [member, this.dataset, completed],
      operator: [Opr.EQUAL, Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };
}
