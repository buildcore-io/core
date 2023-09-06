import { build5Db } from '@build-5/database';
import { COL, SpaceMember, SpaceMemberUpsertRequest, SUB_COL } from '@build-5/interfaces';
import { acceptSpaceMember } from '../../services/payment/tangle-service/space/SpaceAcceptMemberService';

export const acceptSpaceMemberControl = async (owner: string, params: SpaceMemberUpsertRequest) => {
  const { spaceMember, space } = await acceptSpaceMember(owner, params.uid, params.member);

  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${params.uid}`);
  const memberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(spaceMember.uid);
  const knockingMemberDocRef = spaceDocRef
    .collection(SUB_COL.KNOCKING_MEMBERS)
    .doc(spaceMember.uid);

  const batch = build5Db().batch();
  batch.set(memberDocRef, spaceMember);
  batch.delete(knockingMemberDocRef);
  batch.update(spaceDocRef, space);
  await batch.commit();

  return await memberDocRef.get<SpaceMember>();
};
