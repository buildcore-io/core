import { COL, Space, SUB_COL, WenError } from '@build-5/interfaces';
import { head } from 'lodash';
import { soonDb } from '../firebase/firestore/soondb';
import { serverTime } from './dateTime.utils';
import { invalidArgument } from './error.utils';

export const assertSpaceExists = async (spaceId: string) => {
  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${spaceId}`);
  const space = await spaceDocRef.get<Space>();
  if (!space) {
    throw invalidArgument(WenError.space_does_not_exists);
  }
};

export const assertIsSpaceMember = async (space: string, member: string) => {
  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${space}`);
  const spaceMemberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(member);
  const spaceMember = await spaceMemberDocRef.get();
  if (!spaceMember) {
    throw invalidArgument(WenError.you_are_not_part_of_space);
  }
};

export const spaceToIpfsMetadata = (space: Space) => ({
  name: space.name,
  soonaverseId: space.uid,
});

export const getSpace = async (space: string | undefined) => {
  if (!space) {
    return undefined;
  }
  const docRef = soonDb().collection(COL.SPACE).doc(space);
  return await docRef.get<Space>();
};

export const hasActiveEditProposal = async (space: string) => {
  const ongoingProposalSnap = await soonDb()
    .collection(COL.PROPOSAL)
    .where('settings.spaceUpdateData.uid', '==', space)
    .where('settings.endDate', '>=', serverTime())
    .get();
  return ongoingProposalSnap.length > 0;
};

export const getSpaceByAliasId = async (aliasId: string) => {
  const spaces = await soonDb()
    .collection(COL.SPACE)
    .where('alias.aliasId', '==', aliasId)
    .limit(1)
    .get<Space>();
  return head(spaces);
};
