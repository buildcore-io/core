import { database } from '@buildcore/database';
import { COL, Space, SUB_COL, WenError } from '@buildcore/interfaces';
import { head } from 'lodash';
import { invalidArgument } from './error.utils';

export const assertSpaceExists = async (spaceId: string) => {
  const spaceDocRef = database().doc(COL.SPACE, spaceId);
  const space = await spaceDocRef.get();
  if (!space) {
    throw invalidArgument(WenError.space_does_not_exists);
  }
};

export const assertIsSpaceMember = async (space: string, member: string) => {
  const spaceMemberDocRef = database().doc(COL.SPACE, space, SUB_COL.MEMBERS, member);
  const spaceMember = await spaceMemberDocRef.get();
  if (!spaceMember) {
    throw invalidArgument(WenError.you_are_not_part_of_space);
  }
};

export const spaceToIpfsMetadata = (space: Space) => ({
  name: space.name,
  originId: space.uid,
});

export const getSpace = async (space: string | undefined) => {
  if (!space) {
    return undefined;
  }
  const docRef = database().collection(COL.SPACE).doc(space);
  return await docRef.get();
};

export const hasActiveEditProposal = async (space: string) => {
  const ongoingProposalSnap = await database()
    .collection(COL.PROPOSAL)
    .where('space', '==', space)
    .where('completed', '==', false)
    .get();
  return ongoingProposalSnap.length > 0;
};

export const getSpaceByAliasId = async (aliasId: string) => {
  const spaces = await database()
    .collection(COL.SPACE)
    .where('alias_aliasId', '==', aliasId)
    .limit(1)
    .get();
  return head(spaces);
};
