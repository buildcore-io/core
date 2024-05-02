import { ITransaction, PgMemberUpdate, database } from '@buildcore/database';
import {
  ApiError,
  AwardApproveParticipantTangleResponse,
  AwardBadgeType,
  COL,
  IgnoreWalletReason,
  Member,
  Network,
  NetworkAddress,
  SUB_COL,
  TokenDrop,
  TokenDropStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { get, head, isEmpty, set } from 'lodash';
import { getAddress } from '../../../../utils/address.utils';
import { serverTime } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { BaseTangleService, HandlerParams } from '../../base';
import { approveAwardParticipantSchemaObject } from './AwardAppParticipantTangleRequestSchema';

export class AwardApproveParticipantService extends BaseTangleService<AwardApproveParticipantTangleResponse> {
  public handleRequest = async ({
    project,
    owner,
    request,
  }: HandlerParams): Promise<AwardApproveParticipantTangleResponse> => {
    const params = await assertValidationAsync(approveAwardParticipantSchemaObject, request);

    const badges: { [key: string]: string } = {};
    const errors: { [key: string]: ApiError } = {};

    for (const member of params.members.map((m) => m.toLowerCase())) {
      try {
        const badge = await database().runTransaction(
          approveAwardParticipant(project, owner, params.award, member),
        );
        badges[badge.uid] = member;
      } catch (error) {
        errors[member] = {
          code: get(error, 'eCode', 0),
          message: get(error, 'eKey', ''),
        };
        break;
      }
    }
    return { badges, errors };
  };
}

export const approveAwardParticipant =
  (project: string, owner: string, awardId: string, uidOrAddress: NetworkAddress) =>
  async (transaction: ITransaction) => {
    const awardDocRef = database().doc(COL.AWARD, awardId);
    const award = await transaction.get(awardDocRef);

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

    const participantDocRef = database().doc(COL.AWARD, awardId, SUB_COL.PARTICIPANTS, memberId);
    const participant = await transaction.get(participantDocRef);

    const count = (award.issued || 0) + 1;
    const data = { issued: count, completed: count === award.badge.total };
    await transaction.update(awardDocRef, data);

    const participantUpdateData = {
      parentId: award.uid,
      completed: true,
      count: database().inc(1),
      tokenReward: database().inc(award.badge.tokenReward),
    };
    if (!participant) {
      set(participantUpdateData, 'project', project);
    }
    await transaction.upsert(participantDocRef, participantUpdateData);

    const badgeTransaction: Transaction = {
      project,
      type: TransactionType.AWARD,
      uid: getRandomEthAddress(),
      member: memberId,
      space: award.space,
      network: award.network,
      ignoreWallet: isEmpty(memberAddress),
      ignoreWalletReason: isEmpty(memberAddress) ? IgnoreWalletReason.MISSING_TARGET_ADDRESS : null,
      payload: {
        amount: 0,
        type: TransactionPayloadType.BADGE,
        sourceAddress: award.address,
        targetAddress: memberAddress,
        award: award.uid,
        tokenReward: award.badge.tokenReward,
        edition: (participant?.count || 0) + 1,
        participatedOn: participant?.createdOn || serverTime(),
        reconciled: false,
        void: false,
      },
    };
    const badgeTransactionDocRef = database().doc(COL.TRANSACTION, badgeTransaction.uid);
    await transaction.create(badgeTransactionDocRef, badgeTransaction);

    const memberUpdateData: PgMemberUpdate = {
      awardsCompleted: database().inc(1),

      spaces: {
        [award.space]: {
          uid: award.space,
          createdOn: (member?.spaces || {})[award.space]?.createdOn || dayjs().toDate(),
          updatedOn: dayjs().toDate(),

          awardStat: {
            [award.badge.tokenUid]: {
              tokenSymbol: award.badge.tokenSymbol,
              badges: database().arrayUnion(badgeTransaction.uid),
              completed: database().inc(1),
            },
          },

          awardsCompleted: database().inc(1),
        },
      },
    };
    const memberDocRef = database().doc(COL.MEMBER, memberId);
    await transaction.update(memberDocRef, memberUpdateData);

    if (award.badge.tokenReward) {
      const airdrop: TokenDrop = {
        project,
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
      const airdropDocRef = database().doc(COL.AIRDROP, airdrop.uid);
      await transaction.create(airdropDocRef, airdrop);

      const distribution = {
        parentId: airdrop.token,
        uid: memberId,
        totalUnclaimedAirdrop: database().inc(airdrop.count),
      };
      const distributionDocRef = database().doc(
        COL.TOKEN,
        airdrop.token,
        SUB_COL.DISTRIBUTION,
        memberId,
      );
      await transaction.upsert(distributionDocRef, distribution);
    }
    return badgeTransaction;
  };

const getMember = async (network: Network, uidOrAddress: NetworkAddress) => {
  const memberDocRef = database().doc(COL.MEMBER, uidOrAddress);
  const member = await memberDocRef.get();
  if (member) {
    return member;
  }
  const members = await database()
    .collection(COL.MEMBER)
    .where(`${network}Address`, '==', uidOrAddress)
    .limit(1)
    .get();
  return head(members);
};

const getTargetAddres = (
  member: Member | undefined,
  network: Network,
  uidOrAddress: NetworkAddress,
) => {
  const address = getAddress(member, network);
  if (address) {
    return address;
  }
  return uidOrAddress.startsWith(network) ? uidOrAddress : '';
};
