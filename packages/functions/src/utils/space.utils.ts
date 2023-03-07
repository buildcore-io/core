import { COL, Space, SUB_COL, WenError } from '@soonaverse/interfaces';
import admin from '../admin.config';
import { Database } from '../database/Database';
import { throwInvalidArgument } from './error.utils';

export const assertSpaceExists = async (spaceId: string) => {
  const space = await Database.getById<Space>(COL.SPACE, spaceId);
  if (!space) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }
};

export const assertIsSpaceMember = async (space: string, member: string) => {
  const spaceMember = await Database.getById(COL.SPACE, space, SUB_COL.MEMBERS, member);
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
  const docRef = admin.firestore().collection(COL.SPACE).doc(space);
  return <Space | undefined>(await docRef.get()).data();
};
