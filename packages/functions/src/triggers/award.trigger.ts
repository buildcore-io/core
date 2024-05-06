import { PgAward, database } from '@buildcore/database';
import {
  AwardBadgeType,
  COL,
  Network,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@buildcore/interfaces';
import { head } from 'lodash';
import { getProject } from '../utils/common.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';
import { PgDocEvent } from './common';

export const onAwardUpdated = async (event: PgDocEvent<PgAward>) => {
  const { prev, curr } = event;
  if (!prev || !curr || !curr.funded) {
    return;
  }

  if (
    (prev.completed !== curr.completed || prev.badgesMinted !== curr.badgesMinted) &&
    curr.completed &&
    curr.badgesMinted === curr.issued
  ) {
    const targetAddress = await getReturnAddress(curr);

    const burnAlias: Transaction = {
      project: getProject(curr),
      type: TransactionType.AWARD,
      uid: getRandomEthAddress(),
      space: curr.space,
      member: curr.fundedBy,
      network: curr.network as Network,
      payload: {
        type: TransactionPayloadType.BURN_ALIAS,
        sourceAddress: curr.address,
        targetAddress,
        reconciled: false,
        void: false,
        award: curr.uid,
      },
    };
    await database().doc(COL.TRANSACTION, burnAlias.uid).create(burnAlias);

    const remainingBadges = curr.badge_total! - curr.issued!;
    if (curr.badge_type === AwardBadgeType.BASE && remainingBadges) {
      const tokenDocRef = database().doc(COL.TOKEN, curr.badge_tokenUid!);
      const token = (await tokenDocRef.get())!;
      const baseTokenCredit: Transaction = {
        project: getProject(curr),
        type: TransactionType.CREDIT,
        uid: getRandomEthAddress(),
        space: curr.space,
        member: curr.fundedBy,
        network: curr.network as Network,
        payload: {
          type: TransactionPayloadType.AWARD_COMPLETED,
          amount: remainingBadges * curr.badge_tokenReward!,
          sourceAddress: curr.address,
          targetAddress,
          reconciled: false,
          void: false,
          award: curr.uid,
          token: token.uid,
          tokenSymbol: token.symbol,
        },
      };
      await database().doc(COL.TRANSACTION, baseTokenCredit.uid).create(baseTokenCredit);
    }
  }

  if (
    curr.badge_type === AwardBadgeType.NATIVE &&
    (prev.completed !== curr.completed || prev.airdropClaimed !== curr.airdropClaimed) &&
    curr.completed &&
    curr.airdropClaimed === curr.issued
  ) {
    const targetAddress = await getReturnAddress(curr);
    const remainingBadges = curr.badge_total! - curr.issued!;

    const tokenDocRef = database().doc(COL.TOKEN, curr.badge_tokenUid!);
    const token = (await tokenDocRef.get())!;

    const nativeTokensCredit: Transaction = {
      project: getProject(curr),
      type: TransactionType.CREDIT,
      uid: getRandomEthAddress(),
      space: curr.space,
      member: curr.fundedBy,
      network: curr.network as Network,
      payload: {
        type: TransactionPayloadType.AWARD_COMPLETED,
        amount: curr.nativeTokenStorageDeposit,
        nativeTokens: remainingBadges
          ? [
              {
                id: curr.badge_tokenId!,
                amount: BigInt(remainingBadges * curr.badge_tokenReward!),
              },
            ]
          : [],
        sourceAddress: curr.address,
        targetAddress,
        reconciled: false,
        void: false,
        award: curr.uid,
        token: token.uid,
        tokenSymbol: token.symbol,
      },
    };
    await database().doc(COL.TRANSACTION, nativeTokensCredit.uid).create(nativeTokensCredit);
  }
};

const getReturnAddress = async (award: PgAward) => {
  if (award.fundingAddress) {
    return award.fundingAddress;
  }
  const snap = await database()
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.PAYMENT)
    .where('payload_targetAddress', '==', award.address)
    .where('payload_invalidPayment', '==', false)
    .limit(1)
    .get();
  return head(snap)?.payload.sourceAddress || '';
};
