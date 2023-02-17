import {
  Award,
  AwardBadgeType,
  AwardParticipant,
  COL,
  Member,
  Network,
  SUB_COL,
  TokenDrop,
  TokenDropStatus,
  Transaction,
  TransactionAwardType,
  TransactionIgnoreWalletReason,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { get, isEmpty } from 'lodash';
import { Database, TransactionRunner } from '../../database/Database';
import { ITransaction } from '../../database/Tranaction';
import { getAddress } from '../../utils/address.utils';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const approveAwardParticipantControl = async (
  owner: string,
  params: Record<string, unknown>,
) => {
  const members = params.members as string[];
  const awardId = params.award as string;
  const badges: { [key: string]: Transaction } = {};
  const errors: { [key: string]: unknown } = {};

  for (const member of members) {
    try {
      const badge = await approveAwardParticipant(owner, awardId, member);
      badges[badge.uid] = badge;
    } catch (error) {
      errors[member] = {
        code: get(error, 'details.code', ''),
        message: get(error, 'details.key', ''),
      };
    }
  }
  return { badges, errors };
};

const approveAwardParticipant = (owner: string, awardId: string, uidOrAddress: string) =>
  TransactionRunner.runTransaction(async (transaction) => {
    const award = await transaction.getById<Award>(COL.AWARD, awardId);
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

    const member = await getMember(transaction, award.network, uidOrAddress);
    const memberId = member?.uid || uidOrAddress;
    const memberAddress = getAddress(member, award.network) || '';

    const count = (award.issued || 0) + 1;
    const data = {
      uid: award.uid,
      issued: count,
      completed: count === award.badge.total,
    };
    transaction.update({ col: COL.AWARD, data, action: 'update' });

    const participant = await transaction.getById<AwardParticipant>(
      COL.AWARD,
      award.uid,
      SUB_COL.PARTICIPANTS,
      memberId,
    );
    const participantUpdateData = {
      uid: memberId,
      parentId: award.uid,
      parentCol: COL.AWARD,
      completed: true,
      count: Database.inc(1),
      createdOn: participant?.createdOn || serverTime(),
      tokenReward: Database.inc(award.badge.tokenReward),
    };
    transaction.update({
      col: COL.AWARD,
      data: participantUpdateData,
      subCol: SUB_COL.PARTICIPANTS,
      parentId: award.uid,
      action: 'set',
      merge: true,
    });

    const badgeTransaction = {
      type: TransactionType.AWARD,
      uid: getRandomEthAddress(),
      member: memberId,
      space: award.space,
      network: award.network,
      ignoreWallet: isEmpty(memberAddress),
      ignoreWalletReason: TransactionIgnoreWalletReason.MISSING_TARGET_ADDRESS,
      payload: {
        type: TransactionAwardType.BADGE,
        sourceAddress: award.address,
        targetAddress: memberAddress,
        award: award.uid,
        tokenReward: award.badge.tokenReward,
        edition: (participant?.count || 0) + 1,
        participatedOn: participant?.createdOn || dateToTimestamp(dayjs()),
      },
    };
    transaction.update({ col: COL.TRANSACTION, data: badgeTransaction, action: 'set' });

    const memberUpdateData = {
      uid: memberId,

      awardsCompleted: Database.inc(1),
      totalReward: Database.inc(award.badge.tokenReward),

      spaces: {
        [award.space]: {
          uid: award.space,
          createdOn: (member?.spaces || {})[award.space]?.createdOn || serverTime(),
          updatedOn: serverTime(),

          awardStat: {
            [award.badge.tokenUid]: {
              tokenSymbol: award.badge.tokenSymbol,
              badges: Database.arrayUnion(badgeTransaction.uid),
              completed: Database.inc(1),
              totalReward: Database.inc(award.badge.tokenReward),
            },
          },

          awardsCompleted: Database.inc(1),
          totalReward: Database.inc(award.badge.tokenReward),
        },
      },
    };

    transaction.update({ col: COL.MEMBER, data: memberUpdateData, action: 'set', merge: true });

    if (award.badge.tokenReward) {
      const airdrop: TokenDrop = {
        createdBy: owner,
        uid: getRandomEthAddress(),
        member: memberId,
        token: award.badge.tokenUid,
        award: award.uid,
        vestingAt: dateToTimestamp(dayjs()),
        count: award.badge.tokenReward,
        status: TokenDropStatus.UNCLAIMED,
        sourceAddress: award.address,
        isBaseToken: award.badge.type === AwardBadgeType.BASE,
      };
      transaction.update({ col: COL.AIRDROP, data: airdrop, action: 'set' });

      const distribution = {
        parentId: airdrop.token,
        parentCol: COL.TOKEN,
        uid: memberId,
        totalUnclaimedAirdrop: Database.inc(airdrop.count),
      };
      transaction.update({
        col: COL.TOKEN,
        parentId: airdrop.token,
        subCol: SUB_COL.DISTRIBUTION,
        data: distribution,
        action: 'set',
        merge: true,
      });
    }

    return badgeTransaction as Transaction;
  });

const getMember = async (transaction: ITransaction, network: Network, uidOrAddress: string) => {
  const member = await transaction.getById<Member>(COL.MEMBER, uidOrAddress as string);
  if (member) {
    return member;
  }
  return await transaction.getByValidatedAddress<Member>(COL.MEMBER, network, uidOrAddress);
};
