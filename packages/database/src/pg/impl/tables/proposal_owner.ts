import { COL, ProposalMember } from '@build-5/interfaces';
import { Converter } from '../../interfaces/common';
import { PgProposalMembers, PgProposalOwners } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class ProposalOwnerConverter implements Converter<ProposalMember, PgProposalMembers> {
  toPg = (proposalOwner: ProposalMember): PgProposalOwners => ({
    uid: proposalOwner.uid,
    project: proposalOwner.project,
    createdOn: proposalOwner.createdOn?.toDate(),
    parentId: proposalOwner.parentId,
  });

  fromPg = (pg: PgProposalOwners): ProposalMember =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      parentId: pg.parentId,
      parentCol: COL.PROPOSAL,
      createdOn: pgDateToTimestamp(pg.createdOn)!,
    });
}
