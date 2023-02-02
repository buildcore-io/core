import { COL, SUB_COL, WenError } from '@soonaverse/interfaces';
import { Database } from '../database/Database';
import { throwInvalidArgument } from './error.utils';

export const assertIsSpaceMember = async (space: string, member: string) => {
  const spaceMember = await Database.getById(COL.SPACE, space, SUB_COL.MEMBERS, member);
  if (!spaceMember) {
    throw throwInvalidArgument(WenError.you_are_not_part_of_space);
  }
};
