import { COL, Space, SUB_COL, WenError } from '@soonaverse/interfaces';
import { soonDb } from '../firebase/firestore/soondb';
import { throwInvalidArgument } from './error.utils';

export const assertSpaceExists = async (spaceId: string) => {
  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${spaceId}`);
  const space = await spaceDocRef.get<Space>();
  if (!space) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }
};

export const assertIsSpaceMember = async (space: string, member: string) => {
  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${space}`);
  const spaceMemberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(member);
  const spaceMember = await spaceMemberDocRef.get();
  if (!spaceMember) {
    throw throwInvalidArgument(WenError.you_are_not_part_of_space);
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
