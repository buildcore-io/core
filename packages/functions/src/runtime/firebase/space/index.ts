import { GITHUB_REGEXP, ProposalType, TWITTER_REGEXP, WEN_FUNC } from '@soonaverse/interfaces';
import Joi from 'joi';
import { acceptSpaceMemberControl } from '../../../controls/space/member.accept.control';
import { blockMemberControl } from '../../../controls/space/member.block.control';
import { declineMemberControl } from '../../../controls/space/member.decline.control';
import { leaveSpaceControl } from '../../../controls/space/member.leave.control';
import { claimSpaceControl } from '../../../controls/space/space.claim.control';
import { createSpaceControl } from '../../../controls/space/space.create.control';
import { editGuardianControl } from '../../../controls/space/space.guardian.edit.control';
import { joinSpaceControl } from '../../../controls/space/space.join.control';
import { onCall } from '../../../firebase/functions/onCall';
import { CommonJoi } from '../../../services/joi/common';
import { uidSchema } from '../common';

export const spaceIdSchema = Joi.object({ space: CommonJoi.uid() });

export const createSpaceSchema = {
  name: Joi.string().allow(null, '').optional(),
  about: Joi.string().allow(null, '').optional(),
  open: Joi.boolean().allow(false, true).optional(),
  discord: Joi.string().allow(null, '').alphanum().optional(),
  github: Joi.string().allow(null, '').regex(GITHUB_REGEXP).optional(),
  twitter: Joi.string().allow(null, '').regex(TWITTER_REGEXP).optional(),
  avatarUrl: CommonJoi.storageUrl(false),
  bannerUrl: CommonJoi.storageUrl(false),
};

export const createSpace = onCall(WEN_FUNC.cSpace)(
  Joi.object(createSpaceSchema),
  createSpaceControl,
);

export const editSpaceMemberSchema = Joi.object({
  uid: CommonJoi.uid(),
  member: CommonJoi.uid(),
});

export const addGuardian = onCall(WEN_FUNC.addGuardianSpace)(
  editSpaceMemberSchema,
  editGuardianControl(ProposalType.ADD_GUARDIAN),
);

export const removeGuardian = onCall(WEN_FUNC.removeGuardianSpace)(
  editSpaceMemberSchema,
  editGuardianControl(ProposalType.REMOVE_GUARDIAN),
);

export const acceptMemberSpace = onCall(WEN_FUNC.acceptMemberSpace)(
  editSpaceMemberSchema,
  acceptSpaceMemberControl,
);

export const blockMember = onCall(WEN_FUNC.blockMemberSpace)(
  editSpaceMemberSchema,
  blockMemberControl,
);

export const declineMemberSpace = onCall(WEN_FUNC.declineMemberSpace)(
  editSpaceMemberSchema,
  declineMemberControl,
);

export const leaveSpace = onCall(WEN_FUNC.leaveSpace)(uidSchema, leaveSpaceControl);

export const joinSpace = onCall(WEN_FUNC.claimSpace)(uidSchema, joinSpaceControl);

export const claimSpace = onCall(WEN_FUNC.claimSpace)(spaceIdSchema, claimSpaceControl);
