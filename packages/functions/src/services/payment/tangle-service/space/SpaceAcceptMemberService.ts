import { build5Db } from '@build-5/database';
import {
  BaseTangleResponse,
  COL,
  Space,
  SpaceMember,
  SUB_COL,
  WenError,
} from '@build-5/interfaces';
import { getProject, getProjects } from '../../../../utils/common.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { BaseService, HandlerParams } from '../../base';
import { editSpaceMemberSchemaObject } from './SpaceEditMemberTangleRequestSchema';

export class SpaceAcceptMemberService extends BaseService {
  public handleRequest = async ({
    order,
    owner,
    request,
  }: HandlerParams): Promise<BaseTangleResponse> => {
    const params = await assertValidationAsync(editSpaceMemberSchemaObject, request);

    const { spaceMember, space } = await acceptSpaceMember(
      getProject(order),
      owner,
      params.uid,
      params.member,
    );

    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${params.uid}`);
    const spaceMemberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(spaceMember.uid);
    const knockingMemberDocRef = spaceDocRef
      .collection(SUB_COL.KNOCKING_MEMBERS)
      .doc(spaceMember.uid);

    this.transactionService.push({
      ref: spaceMemberDocRef,
      data: spaceMember,
      action: 'set',
    });
    this.transactionService.push({ ref: knockingMemberDocRef, data: {}, action: 'delete' });
    this.transactionService.push({
      ref: spaceDocRef,
      data: space,
      action: 'update',
    });

    return { status: 'success' };
  };
}

export const acceptSpaceMember = async (
  project: string,
  owner: string,
  spaceId: string,
  member: string,
) => {
  await assertIsGuardian(spaceId, owner);

  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${spaceId}`);
  const knockingMember = await spaceDocRef
    .collection(SUB_COL.KNOCKING_MEMBERS)
    .doc(member)
    .get<SpaceMember>();
  if (!knockingMember) {
    throw invalidArgument(WenError.member_did_not_request_to_join);
  }

  const space = await spaceDocRef.get<Space>();
  const spaceMember = {
    project,
    projects: getProjects([space], project),
    uid: member,
    parentId: space,
    parentCol: COL.SPACE,
  };

  const spaceUpdateData = {
    totalMembers: build5Db().inc(1),
    totalPendingMembers: build5Db().inc(-1),
  };

  return { spaceMember, space: spaceUpdateData };
};
