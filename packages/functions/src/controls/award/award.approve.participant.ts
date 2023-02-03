import {
  Award,
  AwardBadgeType,
  COL,
  Entity,
  Member,
  SUB_COL,
  TokenDrop,
  TokenDropStatus,
  Transaction,
  TransactionAwardType,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { Database, TransactionRunner } from '../../database/Database';
import { getAddress } from '../../utils/address.utils';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
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
    if (award.issued === award.badge.total) {
      throw throwInvalidArgument(WenError.no_more_available_badges);
    }
    if (dayjs(award.endDate.toDate()).isBefore(dayjs())) {
      throw throwInvalidArgument(WenError.award_is_no_longer_available);
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
      completed: count === award!.badge.total,
    };
    transaction.update({ col: COL.AWARD, data, action: 'update' });

    const participant = {
      uid: params.member as string,
      parentId: award.uid,
      parentCol: COL.AWARD,
      completed: true,
      count: Database.inc(1),
      tokenReward: Database.inc(award.badge.tokenReward),
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
      type: TransactionType.AWARD,
      uid: getRandomEthAddress(),
      member: params.member,
      space: award.space,
      network: award.network,
      payload: {
        type: TransactionAwardType.BADGE,
        sourceAddress: award.address,
        targetAddress: getAddress(member, award.network),
        award: award.uid,
        tokenReward: award.badge.tokenReward,
      },
    };
    transaction.update({ col: COL.TRANSACTION, data: badgeTransaction, action: 'set' });

    const memberUpdateData = {
      uid: member.uid,
      awardsCompleted: Database.inc(1),
      totalReputation: Database.inc(award.badge.tokenReward),
      spaces: {
        [award.space]: {
          uid: award.space,
          createdOn: (member.spaces || {})[award.space]?.createdOn || serverTime(),
          badges: Database.arrayUnion(badgeTransaction.uid),
          awardsCompleted: Database.inc(1),
          totalReputation: Database.inc(award.badge.tokenReward),
          updateOn: serverTime(),
        },
      },
    };

    transaction.update({ col: COL.MEMBER, data: memberUpdateData, action: 'set', merge: true });

    if (award.badge.tokenReward) {
      if (award.badge.type === AwardBadgeType.BASE) {
        const billPayment = <Transaction>{
          type: TransactionType.BILL_PAYMENT,
          uid: getRandomEthAddress(),
          member: member.uid,
          space: award.space,
          network: award.network,
          payload: {
            amount: award.badge.tokenReward,
            sourceAddress: award.address,
            targetAddress: getAddress(member, award.network),
            ownerEntity: Entity.MEMBER,
            owner: member.uid,
            royalty: false,
            void: false,
            award: award.uid,
            badge: badgeTransaction.uid,
          },
        };
        transaction.update({ col: COL.TRANSACTION, data: billPayment, action: 'set' });
      } else {
        const airdrop: TokenDrop = {
          createdBy: owner,
          uid: getRandomEthAddress(),
          member: member.uid,
          token: award.badge.tokenUid || '',
          award: award.uid,
          vestingAt: dateToTimestamp(dayjs()),
          count: award.badge.tokenReward,
          status: TokenDropStatus.UNCLAIMED,
          sourceAddress: award.address,
        };
        transaction.update({ col: COL.AIRDROP, data: airdrop, action: 'set' });
      }
    }

    return badgeTransaction;
  });
