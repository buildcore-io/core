import {
  Award,
  AwardBadge,
  COL,
  FileMetedata,
  Member,
  Space,
  SpaceMember,
  SUB_COL,
  WenError,
} from '@soonaverse/interfaces';
import { Database } from '../../database/Database';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const createAwardControl = async (owner: string, params: Record<string, unknown>) => {
  const space = await Database.getById<Space>(COL.SPACE, params.space as string);
  if (!space) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }

  const member = await Database.getById<Member>(COL.MEMBER, owner);
  if (!member) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const spaceMember = await Database.getById<SpaceMember>(
    COL.SPACE,
    params.space as string,
    SUB_COL.MEMBERS,
    owner,
  );
  if (!spaceMember) {
    throw throwInvalidArgument(WenError.you_are_not_part_of_space);
  }

  const badge = params.badge as AwardBadge | undefined;
  if (badge?.image) {
    const ntt = await Database.getById<FileMetedata>(COL.BADGES, badge.image.metadata);
    if (!ntt) {
      throw throwInvalidArgument(WenError.ntt_does_not_exists);
    }
    if (ntt.available !== true) {
      throw throwInvalidArgument(WenError.ntt_is_no_longer_available);
    }
  }

  const batchWriter = Database.createBatchWriter();

  const award = {
    ...params,
    uid: getRandomEthAddress(),
    issued: 0,
    rank: 1,
    completed: false,
    endDate: dateToTimestamp(params.endDate as Date, true),
    createdBy: owner,
    approved: false,
    rejected: false,
  };
  batchWriter.set(COL.AWARD, award);

  const awardOwner = { uid: owner, parentId: award.uid, parentCol: COL.AWARD };
  batchWriter.set(COL.AWARD, awardOwner, SUB_COL.OWNERS, award.uid);

  if (badge?.image) {
    batchWriter.update(COL.BADGES, { uid: badge.image.metadata, available: false });
  }

  await batchWriter.commit();

  return await Database.getById<Award>(COL.AWARD, award.uid);
};
