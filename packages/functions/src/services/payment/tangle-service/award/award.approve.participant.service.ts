import { ITransaction, build5Db } from '@build-5/database';
import {
  ApiError,
  Award,
  AwardApproveParticipantTangleResponse,
  AwardBadgeType,
  AwardParticipant,
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
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { get, head, isEmpty, set } from 'lodash';
import { getAddress } from '../../../../utils/address.utils';
import { serverTime } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { BaseService, HandlerParams } from '../../base';
import { approveAwardParticipantSchemaObject } from './AwardAppParticipantTangleRequestSchema';

export class AwardApproveParticipantService extends BaseService {
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
        const badge = await build5Db().runTransaction(
          approveAwardParticipant(project, owner, params.award, member),
        );
        badges[badge.uid] = member;
      } catch (error) {
        errors[member] = {
          code: get(error, 'details.code', 0),
          message: get(error, 'details.key', ''),
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
    const awardDocRef = build5Db().doc(`${COL.AWARD}/${awardId}`);
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
      count: build5Db().inc(1),
      createdOn: participant?.createdOn || serverTime(),
      tokenReward: build5Db().inc(award.badge.tokenReward),
    };
    if (!participant) {
      set(participantUpdateData, 'project', project);
    }
    transaction.set(participantDocRef, participantUpdateData, true);

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
    const badgeTransactionDocRef = build5Db().doc(`${COL.TRANSACTION}/${badgeTransaction.uid}`);
    transaction.create(badgeTransactionDocRef, badgeTransaction);

    const memberUpdateData = {
      uid: memberId,

      awardsCompleted: build5Db().inc(1),
      totalReward: build5Db().inc(award.badge.tokenReward),

      spaces: {
        [award.space]: {
          uid: award.space,
          createdOn: (member?.spaces || {})[award.space]?.createdOn || serverTime(),
          updatedOn: serverTime(),

          awardStat: {
            [award.badge.tokenUid]: {
              tokenSymbol: award.badge.tokenSymbol,
              badges: build5Db().arrayUnion(badgeTransaction.uid),
              completed: build5Db().inc(1),
              totalReward: build5Db().inc(award.badge.tokenReward),
            },
          },

          awardsCompleted: build5Db().inc(1),
          totalReward: build5Db().inc(award.badge.tokenReward),
        },
      },
    };
    const memberDocRef = build5Db().doc(`${COL.MEMBER}/${memberId}`);
    transaction.set(memberDocRef, memberUpdateData, true);

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
      const airdropDocRef = build5Db().doc(`${COL.AIRDROP}/${airdrop.uid}`);
      transaction.create(airdropDocRef, airdrop);

      const distribution = {
        parentId: airdrop.token,
        parentCol: COL.TOKEN,
        uid: memberId,
        totalUnclaimedAirdrop: build5Db().inc(airdrop.count),
      };
      const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${airdrop.token}`);
      const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(memberId);
      transaction.set(distributionDocRef, distribution, true);
    }

    return badgeTransaction;
  };

const getMember = async (network: Network, uidOrAddress: NetworkAddress) => {
  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${uidOrAddress}`);
  const member = await memberDocRef.get<Member>();
  if (member) {
    return member;
  }
  const members = await build5Db()
    .collection(COL.MEMBER)
    .where(`validatedAddress.${network}`, '==', uidOrAddress)
    .get<Member>();
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
