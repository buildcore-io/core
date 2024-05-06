import { Proposal, ProposalMember, ProposalQuestion, ProposalType } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgProposal } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class ProposalConverter implements Converter<Proposal, PgProposal> {
  toPg = (proposal: Proposal) => ({
    uid: proposal.uid,
    project: proposal.project,
    createdOn: proposal.createdOn?.toDate(),
    updatedOn: proposal.updatedOn?.toDate(),
    createdBy: proposal.createdBy,

    space: proposal.space,
    name: proposal.name,
    description: proposal.description,
    additionalInfo: proposal.additionalInfo,
    type: proposal.type,
    approved: proposal.approved,
    rejected: proposal.rejected,
    approvedBy: proposal.approvedBy,
    rejectedBy: proposal.rejectedBy,
    eventId: proposal.eventId,
    totalWeight: proposal.totalWeight,
    token: proposal.token,
    completed: proposal.completed,
    rank: proposal.rank,
    settings_startDate: proposal.settings.startDate?.toDate(),
    settings_endDate: proposal.settings?.endDate?.toDate(),
    settings_guardiansOnly: proposal.settings?.guardiansOnly,
    settings_addRemoveGuardian: proposal.settings?.addRemoveGuardian,
    settings_spaceUpdateData: JSON.stringify(proposal.settings?.spaceUpdateData) as any,
    settings_onlyGuardians: proposal.settings?.onlyGuardians,
    settings_stakeRewardIds: proposal.settings?.stakeRewardIds,
    settings_awards: proposal.settings?.awards,
    questions: JSON.stringify(proposal.questions) as any,
    members: JSON.stringify(proposal.members) as any,

    results: proposal.results,
  });

  fromPg = (pg: PgProposal): Proposal =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      createdOn: pgDateToTimestamp(pg.createdOn),
      updatedOn: pgDateToTimestamp(pg.updatedOn),
      createdBy: pg.createdBy || '',

      name: pg.name!,
      additionalInfo: pg.additionalInfo,
      space: pg.space!,
      members: pg.members as unknown as { [propName: string]: ProposalMember } | undefined,
      description: pg.description!,
      type: pg.type as ProposalType,
      approved: pg.approved!,
      approvedBy: pg.approvedBy,
      rejected: pg.rejected,
      rejectedBy: pg.rejectedBy,
      eventId: pg.eventId,
      settings: {
        startDate: pgDateToTimestamp(pg.settings_startDate)!,
        endDate: pgDateToTimestamp(pg.settings_endDate)!,
        guardiansOnly: pg.settings_guardiansOnly,
        addRemoveGuardian: pg.settings_addRemoveGuardian,
        spaceUpdateData: pg.settings_spaceUpdateData as unknown as any,
        onlyGuardians: pg.settings_onlyGuardians,
        stakeRewardIds: pg.settings_stakeRewardIds,
        awards: pg.settings_awards,
      },
      totalWeight: pg.totalWeight,
      questions: pg.questions as unknown as ProposalQuestion[],
      results: pg.results,
      token: pg.token,
      completed: pg.completed || false,
      rank: pg.rank,
    });
}
