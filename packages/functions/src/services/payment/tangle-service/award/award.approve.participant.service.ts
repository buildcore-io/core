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
import { get, head, isEmpty } from 'lodash';
import { ITransaction } from '../../../../firebase/firestore/interfaces';
import { soonDb } from '../../../../firebase/firestore/soondb';
import { approveAwardParticipantSchema } from '../../../../runtime/firebase/award';
import { getAddress } from '../../../../utils/address.utils';
import { serverTime } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { TransactionService } from '../../transaction-service';

export class AwardApproveParticipantService {
  constructor(readonly transactionService: TransactionService) {}

  public handleApproveParticipantRequest = async (
    owner: string,
    request: Record<string, unknown>,
  ) => {
    const params = {
      award: request.award as string,
      members: request.members as string[],
    };
    await assertValidationAsync(approveAwardParticipantSchema, params);

    const badges: { [key: string]: string } = {};
    const errors: { [key: string]: unknown } = {};

    for (const member of params.members.map((m) => m.toLowerCase())) {
      try {
        const badge = await soonDb().runTransaction(
          approveAwardParticipant(owner, params.award, member),
        );
        badges[badge.uid] = member;
      } catch (error) {
        errors[member] = {
          code: get(error, 'details.code', ''),
          message: get(error, 'details.key', ''),
        };
        break;
      }
    }
    return { badges, errors };
  };
}

export const approveAwardParticipant =
  (owner: string, awardId: string, uidOrAddress: string) => async (transaction: ITransaction) => {
    const awardDocRef = soonDb().doc(`${COL.AWARD}/${awardId}`);
    const award = await transaction.get<Award>(awardDocRef);
    if (!award) {
      throw invalidArgument(WenError.award_does_not_exists);
    }
    if (!award.approved) {
      throw invalidArgument(WenError.award_is_not_approved);
    }
    if (award.issued === award.badge.total) {
      throw invalidArgument(WenError.no_more_available_badges);
    }
    if (dayjs(award.endDate.toDate()).isBefore(dayjs())) {
      throw invalidArgument(WenError.award_is_no_longer_available);
    }
    await assertIsGuardian(award.space, owner);

    const member = await getMember(award.network, uidOrAddress);
    const memberId = member?.uid || uidOrAddress;
    const memberAddress = getTargetAddres(member, award.network, uidOrAddress);

    const participantDocRef = awardDocRef.collection(SUB_COL.PARTICIPANTS).doc(memberId);
    const participant = await transaction.get<AwardParticipant>(participantDocRef);

    const count = (award.issued || 0) + 1;
    const data = {
      uid: award.uid,
      issued: count,
      completed: count === award.badge.total,
    };
    transaction.update(awardDocRef, data);

    const participantUpdateData = {
      uid: memberId,
      parentId: award.uid,
      parentCol: COL.AWARD,
      completed: true,
      count: soonDb().inc(1),
      createdOn: participant?.createdOn || serverTime(),
      tokenReward: soonDb().inc(award.badge.tokenReward),
    };
    transaction.set(participantDocRef, participantUpdateData, true);

    const badgeTransaction = {
      type: TransactionType.AWARD,
      uid: getRandomEthAddress(),
      member: memberId,
      space: award.space,
      network: award.network,
      ignoreWallet: isEmpty(memberAddress),
      ignoreWalletReason: isEmpty(memberAddress)
        ? TransactionIgnoreWalletReason.MISSING_TARGET_ADDRESS
        : null,
      payload: {
        type: TransactionAwardType.BADGE,
        sourceAddress: award.address,
        targetAddress: memberAddress,
        award: award.uid,
        tokenReward: award.badge.tokenReward,
        edition: (participant?.count || 0) + 1,
        participatedOn: participant?.createdOn || serverTime(),
      },
    };
    const badgeTransactionDocRef = soonDb().doc(`${COL.TRANSACTION}/${badgeTransaction.uid}`);
    transaction.create(badgeTransactionDocRef, badgeTransaction);

    const memberUpdateData = {
      uid: memberId,

      awardsCompleted: soonDb().inc(1),
      totalReward: soonDb().inc(award.badge.tokenReward),

      spaces: {
        [award.space]: {
          uid: award.space,
          createdOn: (member?.spaces || {})[award.space]?.createdOn || serverTime(),
          updatedOn: serverTime(),

          awardStat: {
            [award.badge.tokenUid]: {
              tokenSymbol: award.badge.tokenSymbol,
              badges: soonDb().arrayUnion(badgeTransaction.uid),
              completed: soonDb().inc(1),
              totalReward: soonDb().inc(award.badge.tokenReward),
            },
          },

          awardsCompleted: soonDb().inc(1),
          totalReward: soonDb().inc(award.badge.tokenReward),
        },
      },
    };
    const memberDocRef = soonDb().doc(`${COL.MEMBER}/${memberId}`);
    transaction.set(memberDocRef, memberUpdateData, true);

    if (award.badge.tokenReward) {
      const airdrop: TokenDrop = {
        createdBy: owner,
        uid: getRandomEthAddress(),
        member: memberId,
        token: award.badge.tokenUid,
        award: award.uid,
        vestingAt: serverTime(),
        count: award.badge.tokenReward,
        status: TokenDropStatus.UNCLAIMED,
        sourceAddress: award.address,
        isBaseToken: award.badge.type === AwardBadgeType.BASE,
      };
      const airdropDocRef = soonDb().doc(`${COL.AIRDROP}/${airdrop.uid}`);
      transaction.create(airdropDocRef, airdrop);

      const distribution = {
        parentId: airdrop.token,
        parentCol: COL.TOKEN,
        uid: memberId,
        totalUnclaimedAirdrop: soonDb().inc(airdrop.count),
      };
      const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${airdrop.token}`);
      const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(memberId);
      transaction.set(distributionDocRef, distribution, true);
    }

    return badgeTransaction as Transaction;
  };

const getMember = async (network: Network, uidOrAddress: string) => {
  const memberDocRef = soonDb().doc(`${COL.MEMBER}/${uidOrAddress}`);
  const member = await memberDocRef.get<Member>();
  if (member) {
    return member;
  }
  const members = await soonDb()
    .collection(COL.MEMBER)
    .where(`validatedAddress.${network}`, '==', uidOrAddress)
    .get<Member>();
  return head(members);
};

const getTargetAddres = (member: Member | undefined, network: Network, uidOrAddress: string) => {
  const address = getAddress(member, network);
  if (address) {
    return address;
  }
  return uidOrAddress.startsWith(network) ? uidOrAddress : '';
};
