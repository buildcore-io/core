import { ProposalType, WEN_FUNC } from '@build-5/interfaces';
import { acceptSpaceMemberControl } from '../../../controls/space/member.accept.control';
import { blockMemberControl } from '../../../controls/space/member.block.control';
import { declineMemberControl } from '../../../controls/space/member.decline.control';
import { leaveSpaceControl } from '../../../controls/space/member.leave.control';
import { unblockMemberControl } from '../../../controls/space/member.unblock.control';
import { claimSpaceControl } from '../../../controls/space/space.claim.control';
import { createSpaceControl } from '../../../controls/space/space.create.control';
import { editGuardianControl } from '../../../controls/space/space.guardian.edit.control';
import { joinSpaceControl } from '../../../controls/space/space.join.control';
import { updateSpaceControl } from '../../../controls/space/space.update.control';
import { onRequest } from '../../../firebase/functions/onRequest';
import { spaceClaimSchema } from './SpaceClaimRequestSchema';
import { createSpaceSchemaObject } from './SpaceCreateRequestSchema';
import { editSpaceMemberSchemaObject } from './SpaceEditMemberRequestSchema';
import { spaceJoinSchema } from './SpaceJoinRequestSchema';
import { spaceLeaveSchema } from './SpaceLeaveRequestSchema';
import { updateSpaceSchema } from './SpaceUpdateRequestSchema';

export const createSpace = onRequest(WEN_FUNC.createSpace)(
  createSpaceSchemaObject,
  createSpaceControl,
);

export const addGuardian = onRequest(WEN_FUNC.addGuardianSpace)(
  editSpaceMemberSchemaObject,
  editGuardianControl(ProposalType.ADD_GUARDIAN),
);

export const removeGuardian = onRequest(WEN_FUNC.removeGuardianSpace)(
  editSpaceMemberSchemaObject,
  editGuardianControl(ProposalType.REMOVE_GUARDIAN),
);

export const acceptMemberSpace = onRequest(WEN_FUNC.acceptMemberSpace)(
  editSpaceMemberSchemaObject,
  acceptSpaceMemberControl,
);

export const blockMember = onRequest(WEN_FUNC.blockMemberSpace)(
  editSpaceMemberSchemaObject,
  blockMemberControl,
);

export const declineMemberSpace = onRequest(WEN_FUNC.declineMemberSpace)(
  editSpaceMemberSchemaObject,
  declineMemberControl,
);

export const unblockMember = onRequest(WEN_FUNC.unblockMemberSpace)(
  editSpaceMemberSchemaObject,
  unblockMemberControl,
);

export const updateSpace = onRequest(WEN_FUNC.updateSpace)(updateSpaceSchema, updateSpaceControl);

export const leaveSpace = onRequest(WEN_FUNC.leaveSpace)(spaceLeaveSchema, leaveSpaceControl);

export const joinSpace = onRequest(WEN_FUNC.claimSpace)(spaceJoinSchema, joinSpaceControl);

export const claimSpace = onRequest(WEN_FUNC.claimSpace)(spaceClaimSchema, claimSpaceControl);
