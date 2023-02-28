import {
  AwardBadgeType,
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
import admin, { arrayUnion, inc } from '../../../../admin.config';
import { approveAwardParticipantSchema } from '../../../../runtime/firebase/award';
import { getAddress } from '../../../../utils/address.utils';
import { cOn, dateToTimestamp, serverTime, uOn } from '../../../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../../../utils/error.utils';
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

    for (const member of params.members) {
      try {
        const badge = await admin
          .firestore()
          .runTransaction(approveAwardParticipant(owner, params.award, member));
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
  (owner: string, awardId: string, uidOrAddress: string) =>
  async (transaction: admin.firestore.Transaction) => {
    const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${awardId}`);
    const award = (await transaction.get(awardDocRef)).data();
    if (!award) {
      throw throwInvalidArgument(WenError.award_does_not_exists);
    }
    if (!award.approved) {
      throw throwInvalidArgument(WenError.award_is_not_approved);
    }
    if (award.issued === award.badge.total) {
      throw throwInvalidArgument(WenError.no_more_available_badges);
    }
    if (dayjs(award.endDate.toDate()).isBefore(dayjs())) {
      throw throwInvalidArgument(WenError.award_is_no_longer_available);
    }
    await assertIsGuardian(award.space, owner);

    const member = await getMember(award.network, uidOrAddress);
    const memberId = member?.uid || uidOrAddress;
    const memberAddress = getAddress(member, award.network) || '';

    const participantDocRef = awardDocRef.collection(SUB_COL.PARTICIPANTS).doc(memberId);
    const participant = (await transaction.get(participantDocRef)).data();

    const count = (award.issued || 0) + 1;
    const data = {
      uid: award.uid,
      issued: count,
      completed: count === award.badge.total,
    };
    transaction.update(awardDocRef, uOn(data));

    const participantUpdateData = {
      uid: memberId,
      parentId: award.uid,
      parentCol: COL.AWARD,
      completed: true,
      count: inc(1),
      createdOn: participant?.createdOn || serverTime(),
      tokenReward: inc(award.badge.tokenReward),
    };
    transaction.set(participantDocRef, uOn(participantUpdateData), { merge: true });

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
        participatedOn: participant?.createdOn || dateToTimestamp(dayjs()),
      },
    };
    const badgeTransactionDocRef = admin
      .firestore()
      .doc(`${COL.TRANSACTION}/${badgeTransaction.uid}`);
    transaction.create(badgeTransactionDocRef, cOn(badgeTransaction));

    const memberUpdateData = {
      uid: memberId,

      awardsCompleted: inc(1),
      totalReward: inc(award.badge.tokenReward),

      spaces: {
        [award.space]: {
          uid: award.space,
          createdOn: (member?.spaces || {})[award.space]?.createdOn || serverTime(),
          updatedOn: serverTime(),

          awardStat: {
            [award.badge.tokenUid]: {
              tokenSymbol: award.badge.tokenSymbol,
              badges: arrayUnion(badgeTransaction.uid),
              completed: inc(1),
              totalReward: inc(award.badge.tokenReward),
            },
          },

          awardsCompleted: inc(1),
          totalReward: inc(award.badge.tokenReward),
        },
      },
    };
    const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${memberId}`);
    transaction.set(memberDocRef, uOn(memberUpdateData), { merge: true });

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
      const airdropDocRef = admin.firestore().doc(`${COL.AIRDROP}/${airdrop.uid}`);
      transaction.create(airdropDocRef, cOn(airdrop));

      const distribution = {
        parentId: airdrop.token,
        parentCol: COL.TOKEN,
        uid: memberId,
        totalUnclaimedAirdrop: inc(airdrop.count),
      };
      const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${airdrop.token}`);
      const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(memberId);
      transaction.set(distributionDocRef, uOn(distribution), { merge: true });
    }

    return badgeTransaction as Transaction;
  };

const getMember = async (network: Network, uidOrAddress: string) => {
  const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${uidOrAddress}`);
  const member = <Member>(await memberDocRef.get()).data();
  if (member) {
    return member;
  }
  const snap = await admin
    .firestore()
    .collection(COL.MEMBER)
    .where(`validatedAddress.${network}`, '==', uidOrAddress)
    .get();
  return snap.docs[0]?.data() as Member | undefined;
};
