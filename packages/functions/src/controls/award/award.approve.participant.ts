import {
  Award,
  COL,
  DEFAULT_NETWORK,
  Member,
  SUB_COL,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import { round } from 'lodash';
import { Database, TransactionRunner } from '../../database/Database';
import { serverTime } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const approveAwardParticipantControl = async (
  owner: string,
  params: Record<string, unknown>,
) =>
  TransactionRunner.runTransaction(async (transaction) => {
    const award = await transaction.getById<Award>(COL.AWARD, params.uid as string);
    if (!award) {
      throw throwInvalidArgument(WenError.award_does_not_exists);
    }
    if (award.issued >= award.badge.count) {
      throw throwInvalidArgument(WenError.no_more_available_badges);
    }
    await assertIsGuardian(award.space, owner);

    const member = await transaction.getById<Member>(COL.MEMBER, params.member as string);
    if (!member) {
      throw throwInvalidArgument(WenError.member_does_not_exists);
    }

    const count = (award?.issued || 0) + 1;
    const data = {
      uid: award!.uid,
      issued: count,
      completed: count >= award!.badge.count,
    };
    transaction.update({ col: COL.AWARD, data, action: 'update' });

    const participant = {
      uid: params.member as string,
      parentId: award.uid,
      parentCol: COL.AWARD,
      completed: true,
      count: Database.inc(1),
      xp: round(award.badge.xp / award.badge.count),
    };
    transaction.update({
      col: COL.AWARD,
      data: participant,
      subCol: SUB_COL.PARTICIPANTS,
      parentId: award.uid,
      action: 'set',
      merge: true,
    });

    const badgeTransaction = {
      type: TransactionType.BADGE,
      uid: getRandomEthAddress(),
      member: params.member,
      space: award.space,
      network: DEFAULT_NETWORK,
      payload: {
        award: award.uid,
        name: award.name,
        image: award.badge.image || null,
        description: award.description,
        xp: participant.xp,
      },
    };
    transaction.update({ col: COL.TRANSACTION, data: badgeTransaction, action: 'set' });

    const memberUpdateData = {
      uid: member.uid,
      awardsCompleted: Database.inc(1),
      totalReputation: Database.inc(participant.xp),
      spaces: {
        [award.space]: {
          uid: award.space,
          createdOn: (member.spaces || {})[award.space]?.createdOn || serverTime(),
          badges: Database.arrayUnion(badgeTransaction.uid),
          awardsCompleted: Database.inc(1),
          totalReputation: Database.inc(participant.xp),
          updateOn: serverTime(),
        },
      },
    };

    transaction.update({ col: COL.MEMBER, data: memberUpdateData, action: 'set', merge: true });

    return badgeTransaction;
  });
